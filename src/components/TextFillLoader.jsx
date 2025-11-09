import { useEffect, useRef, useState } from "react";
import anime from "animejs";

const TextFillLoader = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const fillRef = useRef(null);
  const waveRef = useRef(null);
  const textContainerRef = useRef(null);

  useEffect(() => {
    // Animate the fill from bottom to top with wave motion
    const fillTimeline = anime.timeline({
      easing: "easeInOutSine",
      duration: 6000,
      update: (anim) => {
        const percent = Math.round(anim.progress);
        setProgress(percent);
      },
      complete: () => {
        // Fade out animation after completion
        anime({
          targets: textContainerRef.current,
          opacity: [1, 0],
          duration: 800,
          easing: "easeOutQuad",
          complete: () => {
            if (onComplete) onComplete();
          },
        });
      },
    });

    // Main fill animation - moves from 100% (bottom) to 0% (top)
    fillTimeline.add({
      targets: fillRef.current,
      translateY: ["100%", "0%"],
      easing: "easeInOutQuad",
      duration: 6000,
    }, 0);

    // Wave motion on the fill surface
    if (waveRef.current) {
      anime({
        targets: waveRef.current,
        d: [
          "M0,50 Q25,45 50,50 T100,50 L100,100 L0,100 Z",
          "M0,50 Q25,55 50,50 T100,50 L100,100 L0,100 Z",
          "M0,50 Q25,45 50,50 T100,50 L100,100 L0,100 Z",
        ],
        easing: "easeInOutSine",
        duration: 2000,
        loop: true,
      });
    }

    return () => {
      fillTimeline.pause();
    };
  }, [onComplete]);

  return (
    <div
      ref={textContainerRef}
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

            {/* Mask for the fill effect */}
            <mask id="fillMask">
              <rect width="100%" height="100%" fill="black" />
              <g ref={fillRef} style={{ transform: "translateY(100%)" }}>
                {/* Wave shape at the top of the fill */}
                <path
                  ref={waveRef}
                  d="M0,50 Q25,45 50,50 T100,50 L100,100 L0,100 Z"
                  fill="white"
                  transform="scale(8, 3)"
                />
                <rect y="50" width="100%" height="100%" fill="white" />
              </g>
            </mask>
          </defs>

          {/* Outline (stroke) of the text */}
          <use
            href="#ninadText"
            fill="none"
            stroke="#ff7a00"
            strokeWidth="2"
            opacity="0.4"
          />

          {/* Filled text using mask */}
          <use
            href="#ninadText"
            fill="url(#gradient)"
            mask="url(#fillMask)"
          />

          {/* Gradient for the fill */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff9a3c" />
              <stop offset="50%" stopColor="#ff7a00" />
              <stop offset="100%" stopColor="#d96500" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Loading text and percentage */}
      <div className="mt-8 text-center">
        <p className="text-ninad-orange text-lg font-medium mb-2">
          Loading Ninad AI...
        </p>
        <p className="text-white text-4xl font-bold tabular-nums">
          {progress}%
        </p>
      </div>

      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${300 + i * 100}px`,
              height: `${300 + i * 100}px`,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, rgba(255, 122, 0, ${
                0.08 - i * 0.02
              }) 0%, transparent 70%)`,
              animation: `pulse ${3 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TextFillLoader;
