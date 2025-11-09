import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const TextFillLoader = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress from 0 to 100
    const duration = 6000; // 6 seconds
    const interval = 50; // Update every 50ms
    const steps = duration / interval;
    const increment = 100 / steps;
    let currentProgress = 0;

    const progressInterval = setInterval(() => {
      currentProgress += increment;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progressInterval);
        
        // Call onComplete after a short delay
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 800);
      }
      setProgress(Math.round(currentProgress));
    }, interval);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: progress >= 100 ? 0 : 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #0a0a0a 0%, #1a0a00 100%)",
      }}
    >
      {/* Main Text with SVG Fill Mask */}
      <div className="relative">
        <svg
          width="100%"
          height="300"
          viewBox="0 0 800 300"
          className="max-w-4xl w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Define the text path */}
            <text
              id="ninadText"
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: "120px",
                fontWeight: "900",
                fontFamily: "system-ui, -apple-system, sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              NINAD AI
            </text>

            {/* Clip path for the fill effect */}
            <clipPath id="fillClip">
              <rect
                x="0"
                y="0"
                width="100%"
                height={`${progress}%`}
                style={{
                  transition: "height 0.05s linear",
                }}
              />
            </clipPath>
          </defs>

          {/* Outline (stroke) of the text */}
          <use
            href="#ninadText"
            fill="none"
            stroke="#ff7a00"
            strokeWidth="2"
            opacity="0.4"
          />

          {/* Filled text using clip path */}
          <use
            href="#ninadText"
            fill="url(#gradient)"
            clipPath="url(#fillClip)"
          />

          {/* Gradient for the fill */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff9a3c" />
              <stop offset="50%" stopColor="#ff7a00" />
              <stop offset="100%" stopColor="#d96500" />
            </linearGradient>
          </defs>

          {/* Animated wave at the fill line */}
          {progress > 0 && progress < 100 && (
            <motion.path
              d="M0,0 Q200,10 400,0 T800,0 L800,20 L0,20 Z"
              fill="url(#gradient)"
              initial={{ y: 300 }}
              animate={{ y: 300 - (progress / 100) * 300 }}
              transition={{ duration: 0.05, ease: "linear" }}
              opacity="0.6"
              style={{
                filter: "blur(2px)",
              }}
            >
              <animate
                attributeName="d"
                values="M0,0 Q200,10 400,0 T800,0 L800,20 L0,20 Z;
                        M0,0 Q200,-10 400,0 T800,0 L800,20 L0,20 Z;
                        M0,0 Q200,10 400,0 T800,0 L800,20 L0,20 Z"
                dur="2s"
                repeatCount="indefinite"
              />
            </motion.path>
          )}
        </svg>
      </div>

      {/* Loading text and percentage */}
      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <p className="text-ninad-orange text-lg font-medium mb-2">
          Loading Ninad AI...
        </p>
        <motion.p
          className="text-white text-4xl font-bold tabular-nums"
          key={progress}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.3 }}
        >
          {progress}%
        </motion.p>
      </motion.div>

      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            initial={{ scale: 0.8, opacity: 0.4 }}
            animate={{
              scale: [0.8, 1.1, 0.8],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
            style={{
              width: `${300 + i * 100}px`,
              height: `${300 + i * 100}px`,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, rgba(255, 122, 0, ${
                0.08 - i * 0.02
              }) 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default TextFillLoader;
