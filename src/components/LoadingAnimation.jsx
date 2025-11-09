import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';
import animationData from '../assets/ninad-ai-loading.json';

const LoadingAnimation = ({ onComplete }) => {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show text after a brief delay for a smoother entrance
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 500);

    return () => clearTimeout(textTimer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-ninad-dark via-black to-ninad-brown flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 122, 0, 0.15) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Lottie Animation */}
      <motion.div
        className="relative z-10 w-full max-w-md px-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        <Lottie
          animationData={animationData}
          loop={false}
          autoplay={true}
          onComplete={onComplete}
          style={{
            width: '100%',
            height: 'auto',
            filter: 'drop-shadow(0 0 30px rgba(255, 122, 0, 0.6))',
          }}
        />
      </motion.div>

      {/* Loading Text */}
      {showText && (
        <motion.div
          className="relative z-10 mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
            Ninad <span className="text-ninad-orange">AI</span>
          </h2>
          <motion.p
            className="text-ninad-orange text-sm font-medium"
            style={{
              textShadow: '0 0 20px rgba(255, 122, 0, 0.5)',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            Loading Ninad AI...
          </motion.p>

          {/* Animated dots */}
          <div className="flex justify-center items-center gap-2 mt-4">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-2 h-2 rounded-full bg-ninad-orange"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Decorative elements - floating particles */}
      {[...Array(8)].map((_, index) => (
        <motion.div
          key={index}
          className="absolute w-1 h-1 rounded-full bg-ninad-orange"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: index * 0.4,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

export default LoadingAnimation;
