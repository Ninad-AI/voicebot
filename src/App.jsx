// src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Ninad AI — Voice Bot Frontend
//
// Flow:
//   1. Login screen (email + password → POST /auth/login → JWT)
//   2. Main voice UI (Orb + Mic)  — tap mic to start / stop conversation
//   3. WebSocket connects to /ws/voice with query params, sends init JSON,
//      then streams continuous PCM16 16 kHz mono audio.
//   4. Backend returns binary PCM16 TTS audio + JSON control messages.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TextFillLoader from "./components/TextFillLoader";
import MicButton from "./components/MicButton";
import Orb from "./components/Orb";
import { startStreamingMic } from "./utils/audioUtils";

// ── Backend URLs ─────────────────────────────────────────────────────────────
const BACKEND_HOST =
  "handy-backend-lightsail.4s7gsqtx7jmn0.ap-south-1.cs.amazonlightsail.com";
const API_BASE = `https://${BACKEND_HOST}`;
const WS_BASE = `wss://${BACKEND_HOST}`;

// ── Defaults for quick testing ───────────────────────────────────────────────
const DEFAULT_INFLUENCER_ID = "influencer_1";
const DEFAULT_PREFERRED_PROVIDER = "vapi";

// ── localStorage key ─────────────────────────────────────────────────────────
const JWT_KEY = "ninad_jwt";

// ─────────────────────────────────────────────────────────────────────────────
//  Login Screen Component
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Login failed (${resp.status})`);
      }

      const data = await resp.json();
      const token = data.access_token || data.token;
      if (!token) throw new Error("No token in login response");

      localStorage.setItem(JWT_KEY, token);
      onLogin(token);
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: "420px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
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
          Sign in to start your voice conversation
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.75rem",
                fontWeight: 500,
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(255,119,0,0.6)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.12)")
              }
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="login-password"
              style={{
                display: "block",
                color: "rgba(255,255,255,0.6)",
                fontSize: "0.75rem",
                fontWeight: 500,
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(255,119,0,0.6)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.12)")
              }
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: "#ff4444",
                fontSize: "0.85rem",
                textAlign: "center",
                marginBottom: "16px",
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              background: loading
                ? "rgba(255,119,0,0.4)"
                : "linear-gradient(135deg, #FF7700, #E99200)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main App Component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  // ── Auth state ──
  const [jwt, setJwt] = useState(() => localStorage.getItem(JWT_KEY) || null);

  // ── Loading animation ──
  const [isLoading, setIsLoading] = useState(true);

  // ── Conversation state ──
  const [conversationActive, setConversationActive] = useState(false);
  const conversationActiveRef = useRef(false);

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
    const timer = setTimeout(() => setIsLoading(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleLoadingComplete = () => setIsLoading(false);

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

      // Build WebSocket URL with query params
      const params = new URLSearchParams({
        influencer_id: DEFAULT_INFLUENCER_ID,
        preferred_provider: DEFAULT_PREFERRED_PROVIDER,
      });
      const wsUrl = `${WS_BASE}/ws/voice?${params.toString()}`;

      console.log("🔗 Connecting to", wsUrl);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("✅ WebSocket connected — sending init message");

        // ── Send the required init JSON message ──
        const initPayload = {
          token: jwt,
          influencer_id: DEFAULT_INFLUENCER_ID,
          preferred_provider: DEFAULT_PREFERRED_PROVIDER,
        };
        ws.send(JSON.stringify(initPayload));

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
              case "auth_failed":
                setErrorMessage("Authentication failed — please log in again.");
                handleLogout();
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
  }, [jwt, cleanup, getAudioContext, processBinaryChunk]);

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
  //  Auth Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleLogin = (token) => {
    setJwt(token);
  };

  const handleLogout = () => {
    cleanup();
    localStorage.removeItem(JWT_KEY);
    setJwt(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render — Login Gate
  // ─────────────────────────────────────────────────────────────────────────
  if (!jwt) {
    return <LoginScreen onLogin={handleLogin} />;
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
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <TextFillLoader onComplete={handleLoadingComplete} />
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
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-2xl">
                    Ninad <span className="text-ninad-start-hover">AI</span>
                  </h1>

                  {/* Logout button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
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
                      e.target.style.background = "rgba(255,68,68,0.2)";
                      e.target.style.borderColor = "rgba(255,68,68,0.3)";
                      e.target.style.color = "#ff6666";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "rgba(255,255,255,0.08)";
                      e.target.style.borderColor = "rgba(255,255,255,0.12)";
                      e.target.style.color = "rgba(255,255,255,0.8)";
                    }}
                  >
                    Logout
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
                <div className="mt-8 text-center" style={{ minHeight: "24px" }}>
                  {statusText && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white text-sm font-medium animate-pulse drop-shadow-lg"
                    >
                      {statusText}
                    </motion.p>
                  )}

                  {conversationActive && isListening && !isResponding && (
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

                  {conversationActive && !isListening && !isResponding && !statusText && (
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

                  {!conversationActive && !statusText && !errorMessage && (
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