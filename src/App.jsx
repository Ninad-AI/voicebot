import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";

function App() {
    const [isLoading, setIsLoading] = useState(true);

    // Conversation state
    const [conversationActive, setConversationActive] = useState(false);
    const conversationActiveRef = useRef(false);

    const [isRecording, setIsRecording] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // WebRTC + WS refs
    const pcRef = useRef(null);
    const wsRef = useRef(null);
    const localStreamRef = useRef(null);

    // Audio playback
    const audioCtxRef = useRef(null);
    const playHeadRef = useRef(0);

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

    // Create or reuse AudioContext
    const getAudioContext = () => {
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            return audioCtxRef.current;
        }

        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContextCtor({ sampleRate: 44100 });
        audioCtxRef.current = ctx;
        playHeadRef.current = ctx.currentTime;
        return ctx;
    };

    // Schedule one TTS chunk for playback
    const playChunk = (base64Chunk) => {
        try {
            const binary = atob(base64Chunk);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const float32 = new Float32Array(bytes.buffer);
            const STREAM_SAMPLE_RATE = 44100;

            const ctx = getAudioContext();
            const buffer = ctx.createBuffer(1, float32.length, STREAM_SAMPLE_RATE);
            buffer.copyToChannel(float32, 0, 0);

            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);

            const now = ctx.currentTime;
            if (playHeadRef.current < now) {
                playHeadRef.current = now + 0.02; // tiny jitter buffer
            }

            src.start(playHeadRef.current);
            playHeadRef.current += buffer.duration;
        } catch (err) {
            console.error("Failed to play chunk", err);
        }
    };

    const cleanupConnection = () => {
        try {
            if (pcRef.current) {
                pcRef.current.getSenders().forEach((sender) => {
                    try {
                        if (sender.track) sender.track.stop();
                    } catch (_) {}
                });
                pcRef.current.close();
            }
        } catch (_) {}

        try {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            }
        } catch (_) {}

        try {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
        } catch (_) {}

        pcRef.current = null;
        wsRef.current = null;
        localStreamRef.current = null;

        setIsRecording(false);
        setIsStreaming(false);
        setIsProcessing(false);
    };

    const startWebRTCSession = async () => {
        try {
            setErrorMessage("");
            setIsProcessing(true);
            setIsRecording(true);

            // 1. Get mic
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            localStreamRef.current = stream;

            // 2. Create RTCPeerConnection and add tracks
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            pcRef.current = pc;

            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            // 3. Create offer BEFORE opening WebSocket
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // 4. Open WebSocket for signaling + audio chunks
            const ws = new WebSocket("wss://ninad-ai-server.onrender.com/ws");
            wsRef.current = ws;

            ws.onopen = () => {
                try {
                    const desc = pc.localDescription;
                    if (!desc) {
                        throw new Error("Missing localDescription");
                    }
                    ws.send(
                        JSON.stringify({
                            offer: {
                                type: desc.type,
                                sdp: desc.sdp,
                            },
                        })
                    );
                } catch (err) {
                    console.error("Failed to send offer over WS", err);
                    setErrorMessage("Failed to send offer");
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ ice: event.candidate }));
                }
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Signaling answer from backend
                    if (data.answer) {
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(data.answer)
                        );
                        return;
                    }

                    // Streaming audio chunk from backend
                    if (data.type === "chunk") {
                        setIsStreaming(true);
                        playChunk(data.chunk);
                        return;
                    }

                    if (data.type === "done") {
                        setIsStreaming(false);
                        return;
                    }

                    if (data.type === "error") {
                        console.error("Server error:", data.message);
                        setErrorMessage("Server error: " + (data.message || "unknown"));
                        return;
                    }
                } catch (err) {
                    console.error("Bad WS message", err);
                }
            };

            ws.onerror = (event) => {
                console.error("WebSocket error", event);
                setErrorMessage("WebSocket error");
            };

            ws.onclose = (event) => {
                console.log(
                    "WebSocket closed",
                    event.code,
                    event.reason || "<no reason>"
                );
                if (conversationActiveRef.current) {
                    setErrorMessage("Connection closed");
                }
                cleanupConnection();
            };

            setIsProcessing(false);
        } catch (err) {
            console.error("Failed to start WebRTC session", err);
            if (err && err.name === "NotAllowedError") {
                setErrorMessage("Microphone permission denied");
            } else {
                setErrorMessage("Mic or connection failed");
            }
            cleanupConnection();
        }
    };

    const handleMicClick = () => {
        if (!conversationActiveRef.current) {
            conversationActiveRef.current = true;
            setConversationActive(true);
            setErrorMessage("");
            startWebRTCSession();
        } else {
            conversationActiveRef.current = false;
            setConversationActive(false);
            cleanupConnection();
        }
    };

    useEffect(() => {
        return () => {
            conversationActiveRef.current = false;
            cleanupConnection();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
