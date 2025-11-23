import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";
import { blobToBase64 } from "./utils/audioUtils";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [, setAudioBlob] = useState(null);
  const [, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const [userTranscript, setUserTranscript] = useState("");

  // Handle loading completion
  useEffect(() => {
    // Set a maximum timeout of 8 seconds to match animation
    const maxLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 8000); // 8 seconds (6s animation + 2s buffer)

    return () => clearTimeout(maxLoadTimer);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setUserTranscript(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
      };
    }
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
      // Stop recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      processRecordedAudio(blob);
    } else if (recording) {
      // Start recognition
      setUserTranscript("");
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
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
      const base64Payload =
        typeof dataUrl === "string" ? dataUrl.split(",")[1] || "" : "";
      const resp = await fetch("http://localhost:8000/api/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64: base64Payload }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json();
      if (
        !json ||
        json.status !== "complete" ||
        !json.audio_base64 ||
        !json.sample_rate ||
        !json.num_samples
      ) {
        throw new Error("Invalid response");
      }
      // Add AI response text if available
      if (json.text && json.text.trim()) {
        setConversation((prev) => [
          ...prev,
          { text: json.text.trim(), isUser: false },
        ]);
      }
      await playFloat32PCM(
        json.audio_base64,
        json.sample_rate,
        json.num_samples
      );
    } catch (e) {
      if (
        e.message.includes("Failed to fetch") ||
        e.message.includes("ERR_CONNECTION_REFUSED")
      ) {
        setErrorMessage(
          "Backend server not available. Please start the server on localhost:8000"
        );
      } else {
        setErrorMessage("Failed to process audio");
      }
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
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate,
    });
    const buffer = ctx.createBuffer(1, numSamples, sampleRate);
    buffer.copyToChannel(float32.subarray(0, numSamples), 0, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    setIsAISpeaking(true);
    src.onended = () => {
      setIsAISpeaking(false);
    };
    src.start();
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Commented out loading animation for now */}
        {/*
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
        */}
        <motion.div key="main">
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
                  forceHoverState={isRecording || isAISpeaking}
                />
              </div>

              {/* Conversation Display */}
              {conversation.length > 0 && (
                <div className="mb-8 w-full max-w-md max-h-64 overflow-y-auto bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  {conversation.slice(-5).map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-2 p-2 rounded-lg text-sm ${
                        msg.isUser
                          ? "bg-orange-500/20 text-orange-100 ml-8"
                          : "bg-white/10 text-white mr-8"
                      }`}
                    >
                      <span className="font-semibold">
                        {msg.isUser ? "You: " : "AI: "}
                      </span>
                      {msg.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex gap-6 items-center justify-center">
                <MicButton
                  isRecording={isRecording}
                  recordingComplete={recordingComplete}
                  onRecordingChange={handleRecordingChange}
                  onAudioLevel={handleAudioLevel}
                />
              </div>

              {/* Status Text */}
              <div className="mt-8 text-center">
                {isRecording && (
                  <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                    Recording...
                  </p>
                )}
                {recordingComplete &&
                  !isRecording &&
                  !isProcessing &&
                  !isAISpeaking && (
                    <p className="text-white text-sm font-medium drop-shadow-lg">
                      Recording saved. Click the mic to send your message.
                    </p>
                  )}
                {isProcessing && (
                  <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                    Processing your message...
                  </p>
                )}
                {isAISpeaking && (
                  <p className="text-white text-sm font-medium animate-pulse drop-shadow-lg">
                    AI is speaking...
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
        {/* )} */}
      </AnimatePresence>
    </>
  );
}

export default App;
