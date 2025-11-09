import { Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const StartButton = ({ onClick, disabled, isStreaming }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative w-16 h-16 rounded-full flex items-center justify-center
        transition-all duration-300 shadow-lg
        ${disabled
          ? 'bg-gray-600 cursor-not-allowed'
          : 'bg-ninad-orange hover:bg-orange-600'
        }
      `}
      whileHover={!disabled ? { scale: 1.1 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={isStreaming ? {
        boxShadow: [
          '0 0 0 0 rgba(255, 122, 0, 0.7)',
          '0 0 0 15px rgba(255, 122, 0, 0)',
        ],
      } : {}}
      transition={isStreaming ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeOut',
      } : { duration: 0.2 }}
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
