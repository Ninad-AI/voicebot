import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingAnimation from "./components/LoadingAnimation";
import MicButton from "./components/MicButton";
import StartButton from "./components/StartButton";
import OrbVisualizer from "./components/OrbVisualizer";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Handle loading completion
  useEffect(() => {
    // Set a maximum timeout of 60 seconds
    const maxLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 60000); // 60 seconds

    return () => clearTimeout(maxLoadTimer);
  }, []);

  const handleLoadingComplete = () => {
    // Called when Lottie animation completes
    setIsLoading(false);
  };

  const handleRecordingChange = (recording, blob = null) => {
    setIsRecording(recording);
    if (!recording && blob) {
      setRecordingComplete(true);
      setAudioBlob(blob);
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
      const response = await fetch("/api/start-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioData: audioBlob ? "audio-data-present" : "no-audio",
        }),
      });

      // Simulate streaming started
      console.log("Stream started (mocked)");

      // Simulate audio activity for orb animation
      simulateAudioActivity();
    } catch (error) {
      console.log("Mock API call - backend not available yet");
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
            <LoadingAnimation onComplete={handleLoadingComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <div className="min-h-screen bg-gradient-to-b from-ninad-dark via-black to-ninad-brown relative overflow-hidden">
              {/* Header - Branding */}
              <header className="absolute top-0 left-0 right-0 p-6 z-10">
                <div className="flex justify-center md:justify-start">
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    Ninad <span className="text-ninad-orange">AI</span>
                  </h1>
                </div>
              </header>

              {/* Main Content Area */}
              <main className="flex flex-col items-center justify-center min-h-screen px-4">
                {/* Animated Orb Visualizer */}
                <div className="mb-20">
                  <OrbVisualizer
                    audioLevel={audioLevel}
                    isActive={isRecording || isStreaming}
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
                    disabled={isStreaming}
                    isStreaming={isStreaming}
                  />
                </div>

                {/* Status Text */}
                <div className="mt-8 text-center">
                  {isRecording && (
                    <p className="text-ninad-orange text-sm font-medium animate-pulse">
                      Recording...
                    </p>
                  )}
                  {recordingComplete && !isRecording && !isStreaming && (
                    <p className="text-green-400 text-sm font-medium">
                      Recording saved. Click Start to begin.
                    </p>
                  )}
                  {isStreaming && (
                    <p className="text-ninad-orange text-sm font-medium animate-pulse">
                      Streaming active...
                    </p>
                  )}
                </div>
              </main>

              {/* Footer */}
              <footer className="absolute bottom-0 left-0 right-0 p-4 text-center">
                <p className="text-gray-500 text-xs">
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
