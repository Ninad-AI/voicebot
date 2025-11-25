import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";

const MicButton = ({ conversationActive, isRecording, onClick }) => {
    const isIdle = !conversationActive;
    const isListening = conversationActive && isRecording;

    const bgClass = isListening
        ? "bg-red-500 hover:bg-red-600 shadow-lg"
        : "bg-ninad-start-base hover:brightness-110 shadow-glow-orange";

    const Icon = isListening ? Mic : MicOff;

    return (
        <motion.button
            onClick={onClick}
            className={`
        relative w-16 h-16 rounded-md flex items-center justify-center
        transition-all duration-300
        ${bgClass}
      `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={
                isListening
                    ? {
                        boxShadow: [
                            "0 0 0 0 rgba(239, 68, 68, 0.7)",
                            "0 0 0 15px rgba(239, 68, 68, 0)",
                        ],
                    }
                    : {
                        boxShadow: [
                            "0 0 20px rgba(255, 119, 0, 0.5)",
                            "0 0 30px rgba(255, 119, 0, 0.7)",
                            "0 0 20px rgba(255, 119, 0, 0.5)",
                        ],
                    }
            }
            transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
            }}
        >
            <Icon className="w-7 h-7 text-white" />
        </motion.button>
    );
};

export default MicButton;