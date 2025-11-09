import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const OrbVisualizer = ({ audioLevel, isActive }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generate random particles for ambient effect
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      angle: (i / 20) * Math.PI * 2,
      distance: 100 + Math.random() * 50,
    }));
    setParticles(newParticles);
  }, []);

  // Calculate orb size based on audio level
  const baseSize = 120;
  const maxGrowth = 80;
  const currentSize = baseSize + (audioLevel * maxGrowth);
  
  // Calculate glow intensity
  const glowIntensity = isActive ? 20 + (audioLevel * 40) : 10;
  const glowColor = isActive ? 'rgba(255, 122, 0, 0.6)' : 'rgba(255, 122, 0, 0.3)';

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Outer glow ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: currentSize + 40,
          height: currentSize + 40,
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
        animate={{
          scale: isActive ? [1, 1.2, 1] : 1,
          opacity: isActive ? [0.5, 0.8, 0.5] : 0.3,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Particles around orb */}
      {particles.map((particle) => {
        const x = Math.cos(particle.angle) * particle.distance;
        const y = Math.sin(particle.angle) * particle.distance;
        
        return (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full bg-ninad-orange"
            style={{
              left: '50%',
              top: '50%',
            }}
            animate={isActive ? {
              x: [0, x, 0],
              y: [0, y, 0],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            } : {
              opacity: 0,
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: particle.id * 0.1,
              ease: 'easeInOut',
            }}
          />
        );
      })}

      {/* Main orb */}
      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: currentSize,
          height: currentSize,
          background: 'radial-gradient(circle at 30% 30%, #ff9a3c, #ff7a00)',
          boxShadow: `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(255, 122, 0, 0.8)`,
        }}
        animate={{
          scale: isActive ? [1, 1 + (audioLevel * 0.3), 1] : 1,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
      >
        {/* Inner light reflection */}
        <motion.div
          className="absolute top-8 left-8 w-12 h-12 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.8), transparent)',
          }}
          animate={{
            opacity: isActive ? [0.6, 1, 0.6] : 0.4,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Audio waves */}
        {isActive && (
          <>
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="absolute rounded-full border-2 border-white"
                style={{
                  width: '100%',
                  height: '100%',
                }}
                animate={{
                  scale: [1, 1.5, 2],
                  opacity: [0.6, 0.3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.6,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </motion.div>

      {/* Bottom shadow */}
      <div
        className="absolute bottom-0"
        style={{
          width: currentSize * 0.8,
          height: 20,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent)',
          filter: 'blur(10px)',
        }}
      />
    </div>
  );
};

export default OrbVisualizer;
