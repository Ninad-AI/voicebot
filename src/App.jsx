// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Ninad AI — Voice Bot Frontend (Meta Demo Backend)
//
// Flow:
//   1. Persona selector — user picks which AI character to chat with
//   2. WebSocket connects to /ws/audio/{persona_name}
//   3. Onboarding prompt plays — "Introduce yourself — your name and 3 things!"
//   4. Client-side VAD sends speech_start/speech_end JSON messages
//   5. PCM16 audio frames (16 kHz mono) streamed between VAD markers
//   6. Backend processes: STT → LLM → TTS voice cloning
//   7. Backend returns binary PCM16 audio + control messages (clone status, etc)
//
// Control Messages from backend:
//   {"type": "onboarding_start"}
//   {"type": "onboarding_done"}
//   {"type": "voice_clone_started"}
//   {"type": "voice_clone_ready", "voice_id": "..."}
//   {"type": "voice_clone_failed"}
//   {"type": "tts_start"} / {"type": "tts_end"}
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";
import { startStreamingMic } from "./utils/audioUtils";

// ── Backend URLs ─────────────────────────────────────────────────────────
// Local development - connect to 0.0.0.0:8000
const BACKEND_HOST = "localhost:8000";
const WS_BASE = `ws://${BACKEND_HOST}`;

// ── Available Personas ───────────────────────────────────────────────────────
const PERSONAS = [
  { id: "deepika", name: "Deepika" },
];

// ── localStorage key ─────────────────────────────────────────────────────────
const SELECTED_PERSONA_KEY = "ninad_selected_persona";

// ─────────────────────────────────────────────────────────────────────────────
//  Persona Selector Component
// ─────────────────────────────────────────────────────────────────────────────
function PersonaSelector({ onSelect }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(to top, #FF7700 0%, #000000 75%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "24px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "500px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "#fff",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          Ninad <span style={{ color: "#FF7700" }}>AI</span>
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            fontSize: "0.875rem",
            marginBottom: "32px",
          }}
        >
          Choose a persona to chat with
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {PERSONAS.map((persona) => (
            <motion.button
              key={persona.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(persona.id)}
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 119, 0, 0.1)",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: "pointer",
                letterSpacing: "0.02em",
                transition: "all 0.2s",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(255, 119, 0, 0.3)";
                e.target.style.borderColor = "rgba(255, 119, 0, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255, 119, 0, 0.1)";
                e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
              }}
            >
              {persona.name}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main App Component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  // ── Persona selection ──
  const [selectedPersona, setSelectedPersona] = useState(() => {
    const saved = localStorage.getItem(SELECTED_PERSONA_KEY);
    return saved || "deepika"; // Auto-select deepika
  });

  // ── Loading animation ──
  const [isLoading, setIsLoading] = useState(true);

  // ── Conversation state ──
  const [conversationActive, setConversationActive] = useState(false);
  const conversationActiveRef = useRef(false);

  // ── Onboarding state ──
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingPrompt, setOnboardingPrompt] = useState("");

  // ── Voice clone state ──
  const [voiceCloneStatus, setVoiceCloneStatus] = useState(null); // null | "started" | "ready" | "failed"
  const [clonedVoiceId, setClonedVoiceId] = useState(null);

  // ── UI indicators ──
  const [isListening, setIsListening] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Audio playback refs ──
  const audioContextRef = useRef(null);
  const playHeadRef = useRef(0);
  const sourceEndPromisesRef = useRef([]);

  // ── WebSocket & mic refs ──
  const wsRef = useRef(null);
  const micControllerRef = useRef(null);

  // ── Loading screen timer ──
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ── Clear error after 6s ──
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(""), 6000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Audio Playback (PCM16 from backend)
  // ─────────────────────────────────────────────────────────────────────────

  /** Lazily create / resume the playback AudioContext. */
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new Ctor();
      playHeadRef.current = audioContextRef.current.currentTime;
      sourceEndPromisesRef.current = [];
    }
    return audioContextRef.current;
  }, []);

  /** Schedule an AudioBuffer for gapless playback. */
  const scheduleBuffer = useCallback(
    (buffer) => {
      const ctx = getAudioContext();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);

      const endPromise = new Promise((resolve) => {
        src.onended = resolve;
      });
      sourceEndPromisesRef.current.push(endPromise);

      if (playHeadRef.current < ctx.currentTime) {
        playHeadRef.current = ctx.currentTime;
      }
      src.start(playHeadRef.current);
      playHeadRef.current += buffer.duration;
    },
    [getAudioContext]
  );

  /**
   * Process a binary PCM16 chunk from the backend.
   * Converts Int16 → Float32, creates an AudioBuffer @ 16 kHz, schedules it.
   */
  const processBinaryChunk = useCallback(
    (arrayBuffer) => {
      const int16 = new Int16Array(arrayBuffer);

      // Convert Int16 → Float32 for Web Audio API
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const sampleRate = 16000; // must match backend TTS output
      const ctx = getAudioContext();
      const buffer = ctx.createBuffer(1, float32.length, sampleRate);
      buffer.copyToChannel(float32, 0, 0);

      scheduleBuffer(buffer);
    },
    [getAudioContext, scheduleBuffer]
  );

  // ─────────────────────────────────────────────────────────────────────────
  //  WebSocket + Mic Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /** Full cleanup — mic + WebSocket + state. */
  const cleanup = useCallback(() => {
    // Stop mic
    if (micControllerRef.current) {
      micControllerRef.current.stop();
      micControllerRef.current = null;
    }
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    // Reset state
    conversationActiveRef.current = false;
    setConversationActive(false);
    setIsListening(false);
    setIsResponding(false);
    setStatusText("");
  }, []);

  /** Handle mic button tap — toggles conversation on/off. */
  const handleMicClick = useCallback(async () => {
    // ── STOP ──
    if (conversationActiveRef.current) {
      console.log("🛑 Stopping conversation…");
      cleanup();
      return;
    }

    // ── START ──
    try {
      setErrorMessage("");
      setStatusText("Connecting…");

      // Build WebSocket URL using selected persona
      const wsUrl = `${WS_BASE}/ws/audio/${selectedPersona}`;

      console.log("🔗 Connecting to", wsUrl);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("✅ WebSocket connected");

        // ── Resume playback AudioContext (user gesture requirement) ──
        const ctx = getAudioContext();
        if (ctx.state === "suspended") await ctx.resume();

        // ── Start mic streaming ──
        try {
          const controller = await startStreamingMic(ws, (level) => {
            setIsListening(level > 0.015);
          });
          micControllerRef.current = controller;

          conversationActiveRef.current = true;
          setConversationActive(true);
          setStatusText("");
          console.log("🎤 Streaming started");
        } catch (micErr) {
          console.error("Mic access failed:", micErr);
          setErrorMessage("Microphone access denied. Please allow mic permissions.");
          cleanup();
        }
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // ── Binary TTS audio ──
          processBinaryChunk(event.data);
        } else {
          // ── JSON control messages ──
          try {
            const msg = JSON.parse(event.data);
            console.log("📩 Control message:", msg);

            switch (msg.type) {
              case "onboarding_start":
                setIsOnboarding(true);
                setStatusText("Onboarding: Please introduce yourself");
                break;

              case "onboarding_done":
                setIsOnboarding(false);
                setStatusText("");
                break;

              case "voice_clone_started":
                setVoiceCloneStatus("started");
                setStatusText("🔄 Cloning your voice...");
                break;

              case "voice_clone_ready":
                setVoiceCloneStatus("ready");
                setClonedVoiceId(msg.voice_id || null);
                setStatusText("✨ Your voice is ready!");
                setTimeout(() => setStatusText(""), 3000);
                break;

              case "voice_clone_failed":
                setVoiceCloneStatus("failed");
                setErrorMessage("Voice cloning failed, using default voice");
                break;

              case "tts_start":
                setIsResponding(true);
                setIsListening(false);
                break;

              case "tts_end":
                setIsResponding(false);
                break;

              case "error":
                setErrorMessage(msg.message || "Server error");
                break;

              case "session_end":
                setStatusText("Session ended");
                cleanup();
                break;

              default:
                // Log unknown control messages
                break;
            }
          } catch {
            // Not valid JSON — ignore
          }
        }
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket error:", err);
        setErrorMessage("Connection error. Please try again.");
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed (code=${event.code})`);
        // Only show error if it was unexpected
        if (conversationActiveRef.current && event.code !== 1000) {
          setErrorMessage("Connection lost. Tap mic to reconnect.");
        }
        cleanup();
      };
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setErrorMessage(err.message || "Failed to connect");
      cleanup();
    }
  }, [selectedPersona, cleanup, getAudioContext, processBinaryChunk]);

  // ── Cleanup on component unmount ──
  useEffect(() => {
    return () => {
      cleanup();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [cleanup]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Persona Selection Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectPersona = (personaId) => {
    setSelectedPersona(personaId);
    localStorage.setItem(SELECTED_PERSONA_KEY, personaId);
  };

  const handleChangePersona = () => {
    cleanup();
    setSelectedPersona(null);
    setVoiceCloneStatus(null);
    setClonedVoiceId(null);
    setIsOnboarding(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render — Persona Selection Gate
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedPersona) {
    return <PersonaSelector onSelect={handleSelectPersona} />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Render — Main Voice UI
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="min-h-screen flex items-center justify-center"
            style={{
              background: "linear-gradient(to top, #FF7700 0%, #000000 75%)",
            }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight drop-shadow-2xl">
              Ninad <span style={{ color: "#FF7700" }}>AI</span>
            </h1>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <div
              className="min-h-screen relative overflow-hidden"
              style={{
                background: "linear-gradient(to top, #FF7700 0%, #000000 75%)",
              }}
            >
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/10 pointer-events-none"></div>

              {/* Header */}
              <header className="absolute top-0 left-0 right-0 p-6 z-10">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-2xl">
                      Ninad <span className="text-ninad-start-hover">AI</span>
                    </h1>
                    {selectedPersona && (
                      <p className="text-sm text-gray-300 mt-1">
                        Chatting with {PERSONAS.find(p => p.id === selectedPersona)?.name}
                      </p>
                    )}
                  </div>

                  {/* Change Persona button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleChangePersona}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "12px",
                      padding: "8px 20px",
                      color: "rgba(255, 255, 255, 0.8)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      letterSpacing: "0.03em",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "rgba(100, 150, 255, 0.2)";
                      e.target.style.borderColor = "rgba(100, 150, 255, 0.3)";
                      e.target.style.color = "#88ccff";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(255,255,255,0.08)";
                      e.target.style.borderColor = "rgba(255,255,255,0.12)";
                      e.target.style.color = "rgba(255,255,255,0.8)";
                    }}
                  >
                    Change Persona
                  </motion.button>
                </div>
              </header>

              {/* Main Content */}
              <main className="flex flex-col items-center justify-center min-h-screen px-4">
                {/* Orb */}
                <div className="mb-20 w-[400px] h-[400px] relative">
                  <Orb
                    hoverIntensity={0.4}
                    rotateOnHover={true}
                    hue={15}
                    forceHoverState={isListening || isResponding}
                  />
                </div>

                {/* Mic Button */}
                <div className="flex gap-6 items-center justify-center">
                  <MicButton
                    conversationActive={conversationActive}
                    isRecording={isListening}
                    onClick={handleMicClick}
                  />
                </div>

                {/* Status Indicators */}
                <div className="mt-8 text-center" style={{ minHeight: "60px" }}>
                  {isOnboarding && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium drop-shadow-lg mb-2"
                      style={{ color: "#FFD700" }}
                    >
                      🎙️ Onboarding: Introduce yourself!
                    </motion.p>
                  )}

                  {voiceCloneStatus === "started" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium animate-pulse drop-shadow-lg"
                      style={{ color: "#87CEEB" }}
                    >
                      🔄 Cloning your voice...
                    </motion.p>
                  )}

                  {voiceCloneStatus === "ready" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium drop-shadow-lg"
                      style={{ color: "#90EE90" }}
                    >
                      ✨ Your voice is ready!
                    </motion.p>
                  )}

                  {statusText && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium animate-pulse drop-shadow-lg"
                    >
                      {statusText}
                    </motion.p>
                  )}

                  {conversationActive && isListening && !isResponding && !isOnboarding && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium animate-pulse drop-shadow-lg"
                    >
                      🎤 Listening…
                    </motion.p>
                  )}

                  {isResponding && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium animate-pulse drop-shadow-lg"
                    >
                      🔊 Responding…
                    </motion.p>
                  )}

                  {conversationActive && !isListening && !isResponding && !statusText && !isOnboarding && !voiceCloneStatus && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium drop-shadow-lg"
                      style={{ opacity: 0.6 }}
                    >
                      Connected — start speaking
                    </motion.p>
                  )}

                  {!!errorMessage && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-medium drop-shadow-lg"
                      style={{ color: "#ff6666" }}
                    >
                      ⚠️ {errorMessage}
                    </motion.p>
                  )}

                  {!conversationActive && !statusText && !errorMessage && !isOnboarding && !voiceCloneStatus && (
                    <p className="text-white text-sm font-medium drop-shadow-lg">
                      Tap the mic to start a conversation.
                    </p>
                  )}
                </div>
              </main>

              {/* Footer */}
              <footer className="absolute bottom-0 left-0 right-0 p-4 text-center z-10">
                <p className="text-white text-xs opacity-80 drop-shadow-lg">
                  © 2026 Ninad AI. Voice-powered conversations.
                </p>
              </footer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;