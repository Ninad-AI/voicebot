import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";
import { blobToBase64, recordUtteranceWithVAD } from "./utils/audioUtils";

function App() {
    const [isLoading, setIsLoading] = useState(true);

    // Conversation state
    const [conversationActive, setConversationActive] = useState(false);
    const conversationActiveRef = useRef(false);

    // Turn-level state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingComplete, setRecordingComplete] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Loading animation
    useEffect(() => {
        const maxLoadTimer = setTimeout(() => {
            setIsLoading(false);
        }, 8000);
        return () => clearTimeout(maxLoadTimer);
    }, []);

    const handleLoadingComplete = () => {
        setIsLoading(false);
    };

    // Auto-reset recordingComplete visual flag
    useEffect(() => {
        if (recordingComplete) {
            const timer = setTimeout(() => {
                setRecordingComplete(false);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [recordingComplete]);

    // Streaming playback from backend (unchanged)
    async function playStreamingJSONLResponse(resp) {
        if (!resp.body) {
            throw new Error("Streaming not supported by this browser");
        }

        const reader = resp.body.getReader();
        const textDecoder = new TextDecoder();

        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        const STREAM_SAMPLE_RATE = 44100;   // must match backend
        const PREBUFFER_SECONDS = 1.5;      // prebuffer to avoid tiny gaps

        const audioCtx = new AudioContextCtor({ sampleRate: STREAM_SAMPLE_RATE });

        let playHead = audioCtx.currentTime;
        let started = false;
        const pendingBuffers = [];
        let pendingDuration = 0;

        let textBuffer = "";

        // Track all sources so we can wait for playback to finish
        const sourceEndPromises = [];

        const scheduleBuffer = (buffer) => {
            const src = audioCtx.createBufferSource();
            src.buffer = buffer;
            src.connect(audioCtx.destination);

            // Promise that resolves when this buffer finishes playing
            const endPromise = new Promise((resolve) => {
                src.onended = resolve;
            });
            sourceEndPromises.push(endPromise);

            if (playHead < audioCtx.currentTime) {
                playHead = audioCtx.currentTime;
            }

            src.start(playHead);
            playHead += buffer.duration;
        };

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                textBuffer += textDecoder.decode(value, { stream: true });

                while (true) {
                    const newlineIndex = textBuffer.indexOf("\n");
                    if (newlineIndex === -1) break;

                    const line = textBuffer.slice(0, newlineIndex).trim();
                    textBuffer = textBuffer.slice(newlineIndex + 1);

                    if (!line) continue;

                    let msg;
                    try {
                        msg = JSON.parse(line);
                    } catch (err) {
                        console.error("Bad JSON from stream:", line);
                        continue;
                    }

                    if (msg.type === "chunk") {
                        const b64 = msg.chunk;

                        const binary = atob(b64);
                        const len = binary.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }

                        const float32 = new Float32Array(bytes.buffer);
                        const ns = float32.length;

                        const buffer = audioCtx.createBuffer(1, ns, STREAM_SAMPLE_RATE);
                        buffer.copyToChannel(float32, 0, 0);

                        if (!started) {
                            pendingBuffers.push(buffer);
                            pendingDuration += buffer.duration;

                            if (pendingDuration >= PREBUFFER_SECONDS) {
                                // Start playback with what we have buffered
                                playHead = audioCtx.currentTime;
                                for (const buf of pendingBuffers) {
                                    scheduleBuffer(buf);
                                }
                                pendingBuffers.length = 0;
                                pendingDuration = 0;
                                started = true;
                            }
                        } else {
                            // Already playing: schedule immediately after current playHead
                            scheduleBuffer(buffer);
                        }
                    } else if (msg.type === "error") {
                        console.error("Server stream error:", msg.message);
                    } else if (msg.type === "done") {
                        // terminal marker, nothing extra
                    }
                }
            }

            {
                const remainingDecoded = textDecoder.decode();
                if (remainingDecoded) {
                    textBuffer += remainingDecoded;
                }
                const remaining = textBuffer.trim();
                if (remaining) {
                    let msg;
                    try {
                        msg = JSON.parse(remaining);
                    } catch (err) {
                        msg = null;
                    }
                    if (msg && msg.type === "chunk") {
                        const b64 = msg.chunk;

                        const binary = atob(b64);
                        const len = binary.length;
                        const bytes = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }

                        const float32 = new Float32Array(bytes.buffer);
                        const ns = float32.length;

                        const buffer = audioCtx.createBuffer(1, ns, STREAM_SAMPLE_RATE);
                        buffer.copyToChannel(float32, 0, 0);

                        if (!started) {
                            pendingBuffers.push(buffer);
                            pendingDuration += buffer.duration;
                        } else {
                            scheduleBuffer(buffer);
                        }
                    }
                }
            }


            // If stream ended before we hit PREBUFFER_SECONDS, just play what we buffered
            if (!started && pendingBuffers.length > 0) {
                let startTime = audioCtx.currentTime;
                for (const buf of pendingBuffers) {
                    const src = audioCtx.createBufferSource();
                    src.buffer = buf;
                    src.connect(audioCtx.destination);

                    const endPromise = new Promise((resolve) => {
                        src.onended = resolve;
                    });
                    sourceEndPromises.push(endPromise);

                    src.start(startTime);
                    startTime += buf.duration;
                }
            }

            // Wait for all scheduled buffers to finish playing
            if (sourceEndPromises.length > 0) {
                await Promise.all(sourceEndPromises);
            }
        } finally {
            try {
                audioCtx.close();
            } catch (_) {
                // ignore
            }
        }
    }


    // Send one utterance to backend and stream reply
    const processRecordedAudio = async (blob) => {
        try {
            setErrorMessage("");
            setIsProcessing(true);
            setIsStreaming(true);

            const dataUrl = await blobToBase64(blob);
            const base64Payload =
                typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";

            const resp = await fetch("https://ninad-ai-server.onrender.com/api/voice-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audio_base64: base64Payload }),
            });

            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }

            await playStreamingJSONLResponse(resp);
        } catch (e) {
            console.error(e);
            setErrorMessage("Failed to process audio");
        } finally {
            setIsStreaming(false);
            setIsProcessing(false);
        }
    };

    // Main conversation loop: VAD record -> send -> play -> repeat
    const runConversationLoop = async () => {
        if (conversationActiveRef.current) return;

        conversationActiveRef.current = true;
        setConversationActive(true);
        setErrorMessage("");

        while (conversationActiveRef.current) {
            try {
                // 1) Listen with VAD
                setIsRecording(true);
                const blob = await recordUtteranceWithVAD({
                    noInputTimeoutMs: 5000, // 5s of no speech => end conversation
                    silenceAfterSpeechMs: 800,
                    maxDurationMs: 30000,
                });

                setIsRecording(false);

                if (!blob) {
                    // user stayed silent for 5s -> end
                    break;
                }

                setRecordingComplete(true);

                // 2) Send to backend and play reply
                await processRecordedAudio(blob);

                setRecordingComplete(false);
            } catch (err) {
                console.error("Conversation loop error", err);
                setErrorMessage("Recording or playback failed");
                break;
            }
        }

        conversationActiveRef.current = false;
        setConversationActive(false);
        setIsRecording(false);
    };

    // Mic click: start convo if idle. If already active, request stop after current turn.
    const handleMicClick = () => {
        if (!conversationActiveRef.current) {
            runConversationLoop();
        } else {
            conversationActiveRef.current = false;
        }
    };

    // Stop loop on unmount
    useEffect(() => {
        return () => {
            conversationActiveRef.current = false;
        };
    }, []);

    return (
        <>
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                    >
                        <TextFillLoader onComplete={handleLoadingComplete} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="main"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                    >
                        <div
                            className="min-h-screen relative overflow-hidden"
                            style={{
                                background: "linear-gradient(to top, #FF7700 0%, #000000 75%)",
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/10 pointer-events-none"></div>

                            <header className="absolute top-0 left-0 right-0 p-6 z-10">
                                <div className="flex justify-center md:justify-start">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-2xl">
                                        Ninad <span className="text-ninad-start-hover">AI</span>
                                    </h1>
                                </div>
                            </header>

                            <main className="flex flex-col items-center justify-center min-h-screen px-4">
                                <div className="mb-20 w-[400px] h-[400px] relative">
                                    <Orb
                                        hoverIntensity={0.4}
                                        rotateOnHover={true}
                                        hue={15}
                                        forceHoverState={isRecording || isStreaming}
                                    />
                                </div>

                                <div className="flex gap-6 items-center justify-center">
                                    <MicButton
                                        conversationActive={conversationActive}
                                        isRecording={isRecording}
                                        onClick={handleMicClick}
                                    />
                                </div>

                                <div className="mt-8 text-center">
                                    {conversationActive && isRecording && (
                                        <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                                            Listening...
                                        </p>
                                    )}
                                    {isStreaming && (
                                        <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                                            Responding...
                                        </p>
                                    )}
                                    {isProcessing && !isStreaming && (
                                        <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                                            Processing...
                                        </p>
                                    )}
                                    {!!errorMessage && (
                                        <p className="text-white text-sm font-medium drop-shadow-lg">
                                            {errorMessage}
                                        </p>
                                    )}
                                    {!conversationActive && !isProcessing && !isStreaming && (
                                        <p className="text-white text-sm font-medium drop-shadow-lg">
                                            Tap the mic to start a conversation.
                                        </p>
                                    )}
                                </div>
                            </main>

                            <footer className="absolute bottom-0 left-0 right-0 p-4 text-center z-10">
                                <p className="text-white text-xs opacity-80 drop-shadow-lg">
                                    © 2025 Ninad AI. Voice-powered conversations.
                                </p>
                            </footer>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default App;
