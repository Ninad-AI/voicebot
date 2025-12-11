// Final integrated App.jsx with full UI and updated WebRTC streaming logic
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";

function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [conversationActive, setConversationActive] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const conversationActiveRef = useRef(false);
    const audioCtxRef = useRef(null);
    const playTimeRef = useRef(0);

    useEffect(() => {
        const maxLoadTimer = setTimeout(() => setIsLoading(false), 8000);
        return () => clearTimeout(maxLoadTimer);
    }, []);

    const handleLoadingComplete = () => setIsLoading(false);

    const connectAndStream = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        const ws = new WebSocket("wss://ninad-ai-server.onrender.com/ws");

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "chunk") {
                const binary = atob(data.chunk);
                const buf = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);

                const float32 = new Float32Array(buf.buffer);
                const ctx = audioCtxRef.current || new AudioContext({ sampleRate: 44100 });
                audioCtxRef.current = ctx;

                const audioBuf = ctx.createBuffer(1, float32.length, 44100);
                audioBuf.copyToChannel(float32, 0);

                const src = ctx.createBufferSource();
                src.buffer = audioBuf;
                src.connect(ctx.destination);

                const now = ctx.currentTime;
                if (playTimeRef.current < now) playTimeRef.current = now + 0.02;
                src.start(playTimeRef.current);
                playTimeRef.current += audioBuf.duration;
            }
        };

        ws.onopen = async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ offer }));
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) ws.send(JSON.stringify({ ice: event.candidate }));
        };

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.answer) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        };
    };

    const handleMicClick = () => {
        if (!conversationActiveRef.current) {
            conversationActiveRef.current = true;
            setConversationActive(true);
            setIsRecording(true);
            setErrorMessage("");
            connectAndStream();
        } else {
            conversationActiveRef.current = false;
            setConversationActive(false);
            setIsRecording(false);
        }
    };

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
                            style={{ background: "linear-gradient(to top, #FF7700 0%, #000000 75%)" }}
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
                                        <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">Listening...</p>
                                    )}
                                    {isStreaming && (
                                        <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">Responding...</p>
                                    )}
                                    {!!errorMessage && (
                                        <p className="text-white text-sm font-medium drop-shadow-lg">{errorMessage}</p>
                                    )}
                                    {!conversationActive && !isStreaming && (
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
