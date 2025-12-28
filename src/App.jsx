import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";
import { blobToBase64, recordUtteranceWithVAD } from "./utils/audioUtils";

const BACKEND_URL = "http://localhost:8000";

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

    // Audio playback
    const audioContextRef = useRef(null);
    const playHeadRef = useRef(0);
    const sourceEndPromisesRef = useRef([]);

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

    // Initialize audio context
    const getAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContextCtor();
            playHeadRef.current = audioContextRef.current.currentTime;
            sourceEndPromisesRef.current = [];
        }
        return audioContextRef.current;
    };

    // Schedule audio buffer for playback
    const scheduleBuffer = (buffer) => {
        const audioCtx = getAudioContext();
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(audioCtx.destination);

        const endPromise = new Promise((resolve) => {
            src.onended = resolve;
        });
        sourceEndPromisesRef.current.push(endPromise);

        if (playHeadRef.current < audioCtx.currentTime) {
            playHeadRef.current = audioCtx.currentTime;
        }

        src.start(playHeadRef.current);
        playHeadRef.current += buffer.duration;
    };

    // Process binary audio chunk
    const processBinaryChunk = (arrayBuffer) => {
        const pcmData = new Float32Array(arrayBuffer);
        const sampleRate = 44100; // must match model output

        const audioCtx = getAudioContext();
        const buffer = audioCtx.createBuffer(1, pcmData.length, sampleRate);
        buffer.copyToChannel(pcmData, 0, 0);

        scheduleBuffer(buffer);
    };




    // WebSocket-based audio processing (new approach)
    const processRecordedAudioWS = async (blob) => {
        return new Promise((resolve, reject) => {
            try {
                setErrorMessage("");
                setIsProcessing(true);
                setIsStreaming(true);

                const ws = new WebSocket(`${BACKEND_URL.replace('http', 'ws')}/ws`);
                ws.binaryType = "arraybuffer";

                ws.onopen = () => {
                    console.log("WebSocket connected, sending audio...");
                    blob.arrayBuffer().then(buffer => {
                        ws.send(buffer);          // send full audio
                        ws.send("__END__");       // 🔑 SIGNAL END OF INPUT
                    });
                };

                ws.onmessage = async (event) => {
                    // 1️⃣ Binary audio chunk
                    if (event.data instanceof ArrayBuffer) {
                        processBinaryChunk(event.data);
                        return;
                    }

                    // 2️⃣ Text control message (string OR Blob)
                    let text;
                    if (typeof event.data === "string") {
                        text = event.data;
                    } else if (event.data instanceof Blob) {
                        text = await event.data.text();
                    } else {
                        console.warn("Unknown WS message type", event.data);
                        return;
                    }

                    try {
                        const msg = JSON.parse(text);

                        if (msg.type === "done") {
                            console.log("Stream complete");
                            ws.close();
                        } else if (msg.type === "error") {
                            console.error("Server error:", msg.message);
                            setErrorMessage(msg.message);
                            ws.close();
                        }
                    } catch (e) {
                        console.error("Failed to parse WS message:", text, e);
                    }
                };




                ws.onerror = (error) => {
                    console.error("WebSocket error:", error);
                    setErrorMessage("WebSocket connection failed");
                    reject(error);
                };

                ws.onclose = async () => {
                    console.log("WebSocket closed");

                    // Wait for all audio to finish playing
                    if (sourceEndPromisesRef.current.length > 0) {
                        await Promise.all(sourceEndPromisesRef.current);
                        sourceEndPromisesRef.current = [];
                    }

                    setIsStreaming(false);
                    setIsProcessing(false);
                    resolve();
                };

            } catch (e) {
                console.error(e);
                setErrorMessage("Failed to process audio");
                setIsStreaming(false);
                setIsProcessing(false);
                reject(e);
            }
        });
    };

    // Legacy HTTP-based processing (fallback)
    const processRecordedAudioHTTP = async (blob) => {
        try {
            setErrorMessage("");
            setIsProcessing(true);
            setIsStreaming(true);

            const dataUrl = await blobToBase64(blob);
            const base64Payload =
                typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";

            const resp = await fetch(`${BACKEND_URL}/api/voice-chat`, {
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

    // Legacy JSONL streaming (for backward compatibility)
    async function playStreamingJSONLResponse(resp) {
        if (!resp.body) {
            throw new Error("Streaming not supported by this browser");
        }

        const reader = resp.body.getReader();
        const textDecoder = new TextDecoder();
        const audioCtx = getAudioContext();

        let textBuffer = "";

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
                        const buffer = audioCtx.createBuffer(1, float32.length, msg.sample_rate);
                        buffer.copyToChannel(float32, 0, 0);
                        scheduleBuffer(buffer);
                    }
                }
            }

            // Wait for playback to complete
            if (sourceEndPromisesRef.current.length > 0) {
                await Promise.all(sourceEndPromisesRef.current);
                sourceEndPromisesRef.current = [];
            }
        } finally {
            // Don't close audio context as it's reused
        }
    }

    // Main conversation loop
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
                    noInputTimeoutMs: 5000,
                    silenceAfterSpeechMs: 800,
                    maxDurationMs: 30000,
                });

                setIsRecording(false);

                if (!blob) {
                    break;
                }

                setRecordingComplete(true);

                // 2) Send to backend and play reply (prefer WebSocket)
                try {
                    await processRecordedAudioWS(blob);
                } catch (wsError) {
                    console.warn("WebSocket failed, falling back to HTTP:", wsError);
                    await processRecordedAudioHTTP(blob);
                }

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

    const handleMicClick = () => {
        if (!conversationActiveRef.current) {
            runConversationLoop();
        } else {
            conversationActiveRef.current = false;
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            conversationActiveRef.current = false;
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
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