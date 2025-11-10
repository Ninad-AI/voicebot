import { Play, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const StartButton = ({ onClick, disabled, isStreaming }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-16 h-16 rounded-md flex items-center justify-center
        transition-all duration-300
        ${
          disabled
            ? "bg-gray-600 cursor-not-allowed opacity-50"
            : "bg-button-start hover:brightness-110 shadow-glow-orange"
        }
      `}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={
        isStreaming
          ? {
              boxShadow: [
                "0 0 0 0 rgba(255, 119, 0, 0.7)",
                "0 0 0 15px rgba(255, 119, 0, 0)",
              ],
            }
          : !disabled && {
              boxShadow: [
                "0 0 20px rgba(255, 119, 0, 0.5)",
                "0 0 30px rgba(255, 119, 0, 0.7)",
                "0 0 20px rgba(255, 119, 0, 0.5)",
              ],
            }
      }
      transition={
        isStreaming
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
            }
          : {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
    >
      {isStreaming ? (
        <Loader2 className="w-7 h-7 text-white animate-spin" />
      ) : (
        <Play className="w-7 h-7 text-white ml-1" />
      )}
    </motion.button>
  );
};

export default StartButton;
