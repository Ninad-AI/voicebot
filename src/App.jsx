import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import StartButton from "./components/StartButton";
import Orb from "./components/Orb";
import { blobToBase64 } from "./utils/audioUtils";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [, setAudioBlob] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Handle loading completion
  useEffect(() => {
    // Set a maximum timeout of 8 seconds to match animation
    const maxLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 8000); // 8 seconds (6s animation + 2s buffer)

    return () => clearTimeout(maxLoadTimer);
  }, []);

  const handleLoadingComplete = () => {
    // Called when text fill animation completes
    setIsLoading(false);
  };

  const handleRecordingChange = (recording, blob = null) => {
    setIsRecording(recording);
    if (!recording && blob) {
      setRecordingComplete(true);
      setAudioBlob(blob);
      processRecordedAudio(blob);
    }
  };

  // Auto-reset recordingComplete to false after 2.5 seconds
  useEffect(() => {
    if (recordingComplete) {
      const timer = setTimeout(() => {
        setRecordingComplete(false);
      }, 2500); // 2.5 seconds

      return () => clearTimeout(timer);
    }
  }, [recordingComplete]);

  const handleStartStream = async () => {
    setIsStreaming(true);

    // Mock API call to backend
    try {
      

      // Simulate streaming started
      console.log("Stream started (mocked)");

      // Simulate audio activity for orb animation
      simulateAudioActivity();
    } catch (error) {
      console.warn("Mock API call - backend not available yet", error);
      // Still simulate streaming for demo purposes
      simulateAudioActivity();
    }
  };

  const simulateAudioActivity = () => {
    // Simulate varying audio levels for the orb animation
    let counter = 0;
    const interval = setInterval(() => {
      const level = Math.sin(counter / 10) * 0.5 + 0.5; // Oscillate between 0 and 1
      setAudioLevel(level);
      counter++;

      // Stop after 10 seconds
      if (counter > 100) {
        clearInterval(interval);
        setIsStreaming(false);
        setAudioLevel(0);
      }
    }, 100);
  };

  const handleAudioLevel = (level) => {
    if (isRecording) {
      setAudioLevel(level);
    }
  };

  const processRecordedAudio = async (blob) => {
    try {
      setErrorMessage("");
      setIsProcessing(true);
      const dataUrl = await blobToBase64(blob);
      const base64Payload = typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";
      const resp = await fetch("https://ninad-ai-server.onrender.com/api/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64Payload }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json();
      if (!json || json.status !== "complete" || !json.audio_base64 || !json.sample_rate || !json.num_samples) {
        throw new Error("Invalid response");
      }
      await playFloat32PCM(json.audio_base64, json.sample_rate, json.num_samples);
    } catch (e) {
      setErrorMessage("Failed to process audio");
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const playFloat32PCM = async (audioBase64, sampleRate, numSamples) => {
    const binary = atob(audioBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    const float32 = new Float32Array(bytes.buffer);
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    buffer.copyToChannel(float32.subarray(0, numSamples), 0, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
  };

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
              {/* Subtle overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/10 pointer-events-none"></div>

              {/* Header - Branding */}
              <header className="absolute top-0 left-0 right-0 p-6 z-10">
                <div className="flex justify-center md:justify-start">
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-2xl">
                    Ninad <span className="text-ninad-start-hover">AI</span>
                  </h1>
                </div>
              </header>

              {/* Main Content Area */}
              <main className="flex flex-col items-center justify-center min-h-screen px-4">
                {/* Animated Orb Visualizer */}
                <div className="mb-20 w-[400px] h-[400px] relative">
                  <Orb
                    hoverIntensity={0.4}
                    rotateOnHover={true}
                    hue={15}
                    forceHoverState={isRecording || isStreaming}
                  />
                </div>

                {/* Control Buttons */}
                <div className="flex gap-6 items-center justify-center">
                  <MicButton
                    isRecording={isRecording}
                    recordingComplete={recordingComplete}
                    onRecordingChange={handleRecordingChange}
                    onAudioLevel={handleAudioLevel}
                  />
                  <StartButton
                    onClick={handleStartStream}
                    disabled={isStreaming || isProcessing}
                    isStreaming={isStreaming}
                  />
                </div>

                {/* Status Text */}
                <div className="mt-8 text-center">
                  {isRecording && (
                    <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                      Recording...
                    </p>
                  )}
                  {recordingComplete && !isRecording && !isStreaming && (
                    <p className="text-white text-sm font-medium drop-shadow-lg">
                      Recording saved. Click Start to begin.
                    </p>
                  )}
                  {isStreaming && (
                    <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                      Streaming active...
                    </p>
                  )}
                  {isProcessing && (
                    <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                      Processing...
                    </p>
                  )}
                  {!!errorMessage && (
                    <p className="text-white text-sm font-medium drop-shadow-lg">
                      {errorMessage}
                    </p>
                  )}
                </div>
              </main>

              {/* Footer */}
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
