import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';

const LoadingScreen = ({ onComplete }) => {
  const gradientRef = useRef(null);
  const orbRef = useRef(null);
  const orb2Ref = useRef(null);
  const orb3Ref = useRef(null);
  const textRef = useRef(null);
  const dotsRef = useRef(null);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show text after initial delay
    setTimeout(() => setShowText(true), 500);

    // Animated gradient background (simulate moving light waves)
    const gradientAnimation = anime({
      targets: gradientRef.current,
      background: [
        'radial-gradient(ellipse at 0% 50%, #2b1100 0%, #000000 50%, #1a0a00 100%)',
        'radial-gradient(ellipse at 100% 50%, #1a0a00 0%, #000000 50%, #2b1100 100%)',
        'radial-gradient(ellipse at 50% 0%, #2b1100 0%, #000000 50%, #1a0a00 100%)',
        'radial-gradient(ellipse at 50% 100%, #1a0a00 0%, #000000 50%, #2b1100 100%)',
        'radial-gradient(ellipse at 0% 50%, #2b1100 0%, #000000 50%, #1a0a00 100%)',
      ],
      easing: 'easeInOutSine',
      duration: 20000,
      loop: true,
    });

    // Main orb - outer glow
    const orbAnimation = anime({
      targets: orbRef.current,
      scale: [1, 1.3, 1],
      opacity: [0.6, 0.9, 0.6],
      easing: 'easeInOutSine',
      duration: 4000,
      loop: true,
    });

    // Middle orb layer
    const orb2Animation = anime({
      targets: orb2Ref.current,
      scale: [1, 1.5, 1],
      opacity: [0.4, 0.7, 0.4],
      easing: 'easeInOutSine',
      duration: 5000,
      delay: 500,
      loop: true,
    });

    // Inner orb core
    const orb3Animation = anime({
      targets: orb3Ref.current,
      scale: [1, 1.2, 1],
      rotate: [0, 360],
      opacity: [0.8, 1, 0.8],
      easing: 'spring(1, 80, 10, 0)',
      duration: 6000,
      loop: true,
    });

    // Text fade in
    if (textRef.current) {
      anime({
        targets: textRef.current,
        opacity: [0, 1],
        translateY: [20, 0],
        easing: 'easeOutExpo',
        duration: 1500,
      });
    }

    // Animated dots
    if (dotsRef.current) {
      anime({
        targets: dotsRef.current.children,
        opacity: [0.3, 1, 0.3],
        scale: [1, 1.3, 1],
        delay: anime.stagger(200),
        easing: 'easeInOutSine',
        duration: 1500,
        loop: true,
      });
    }

    // Cleanup animations on unmount
    return () => {
      gradientAnimation.pause();
      orbAnimation.pause();
      orb2Animation.pause();
      orb3Animation.pause();
    };
  }, []);

  return (
    <div
      ref={gradientRef}
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #2b1100 0%, #000000 50%, #1a0a00 100%)',
      }}
    >
      {/* Ambient light effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${200 + i * 50}px`,
              height: `${200 + i * 50}px`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, rgba(255, 122, 0, ${0.1 - i * 0.015}) 0%, transparent 70%)`,
              animation: `pulse ${3 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Central Orb - Multi-layered */}
      <div className="relative z-10 flex items-center justify-center">
        {/* Outer glow layer */}
        <div
          ref={orbRef}
          className="absolute w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 122, 0, 0.3) 0%, rgba(255, 122, 0, 0.1) 40%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Middle layer */}
        <div
          ref={orb2Ref}
          className="absolute w-72 h-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 154, 60, 0.5) 0%, rgba(255, 122, 0, 0.2) 50%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />

        {/* Inner core with gradient */}
        <div
          ref={orb3Ref}
          className="relative w-48 h-48 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #ff9a3c, #ff7a00 40%, #d96500)',
            boxShadow: '0 0 60px 30px rgba(255, 122, 0, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Inner highlight */}
          <div
            className="absolute top-6 left-6 w-16 h-16 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), transparent)',
              filter: 'blur(10px)',
            }}
          />

          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' /%3E%3C/svg%3E")`,
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        {/* Rotating ring particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full bg-ninad-orange"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-140px)`,
              opacity: 0.6,
              animation: `orbit ${20 + i}s linear infinite`,
              animationDelay: `${-i * 1.5}s`,
              boxShadow: '0 0 10px rgba(255, 122, 0, 0.8)',
            }}
          />
        ))}
      </div>

      {/* Branding and Text */}
      {showText && (
        <div ref={textRef} className="relative z-20 mt-32 text-center" style={{ opacity: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
            Ninad <span className="text-ninad-orange" style={{ textShadow: '0 0 30px rgba(255, 122, 0, 0.8)' }}>AI</span>
          </h1>
          <p
            className="text-ninad-orange text-base font-medium mb-4"
            style={{
              textShadow: '0 0 20px rgba(255, 122, 0, 0.6)',
            }}
          >
            Loading Ninad AI...
          </p>

          {/* Animated dots */}
          <div ref={dotsRef} className="flex justify-center items-center gap-2">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="w-2.5 h-2.5 rounded-full bg-ninad-orange"
                style={{
                  boxShadow: '0 0 10px rgba(255, 122, 0, 0.8)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Light refraction effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-1 h-full opacity-10"
          style={{
            background: 'linear-gradient(to bottom, transparent, #ff7a00, transparent)',
            animation: 'flicker 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-0 right-1/3 w-1 h-full opacity-10"
          style={{
            background: 'linear-gradient(to bottom, transparent, #ff9a3c, transparent)',
            animation: 'flicker 10s ease-in-out infinite',
            animationDelay: '2s',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes orbit {
          from {
            transform: translate(-50%, -50%) rotate(0deg) translateY(-140px);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg) translateY(-140px);
          }
        }

        @keyframes flicker {
          0%, 100% {
            opacity: 0.05;
          }
          50% {
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
