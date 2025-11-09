import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Check } from "lucide-react";
import { motion } from "framer-motion";
import { startRecording, stopRecording } from "../utils/audioUtils";

const MicButton = ({
  isRecording,
  recordingComplete,
  onRecordingChange,
  onAudioLevel,
}) => {
  const [isMuted, setIsMuted] = useState(true);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const toggleRecording = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const { mediaRecorder, audioContext, analyser } =
          await startRecording();
        mediaRecorderRef.current = mediaRecorder;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        setIsMuted(false);
        onRecordingChange(true);

        // Start audio level monitoring
        monitorAudioLevel();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            onRecordingChange(false, event.data);
          }
        };
      } catch (error) {
        console.error("Error starting recording:", error);
        alert("Could not access microphone. Please grant permission.");
      }
    } else {
      // Stop recording
      stopRecording(mediaRecorderRef.current, audioContextRef.current);
      setIsMuted(true);

      // Stop audio level monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1

      onAudioLevel(normalizedLevel);

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <motion.button
      onClick={toggleRecording}
      className={`
        relative w-16 h-16 rounded-full flex items-center justify-center
        transition-all duration-300 shadow-lg
        ${
          recordingComplete && !isRecording
            ? "bg-green-500 hover:bg-green-600"
            : isRecording
            ? "bg-red-500 hover:bg-red-600"
            : "bg-ninad-orange hover:bg-orange-600"
        }
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={
        isRecording
          ? {
              boxShadow: [
                "0 0 0 0 rgba(239, 68, 68, 0.7)",
                "0 0 0 15px rgba(239, 68, 68, 0)",
              ],
            }
          : {}
      }
      transition={
        isRecording
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }
          : { duration: 0.2 }
      }
    >
      {recordingComplete && !isRecording ? (
        <Check className="w-7 h-7 text-white" />
      ) : isMuted && !isRecording ? (
        <MicOff className="w-7 h-7 text-white" />
      ) : (
        <Mic className="w-7 h-7 text-white" />
      )}
    </motion.button>
  );
};

export default MicButton;
