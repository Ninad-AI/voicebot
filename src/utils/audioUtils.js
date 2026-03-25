// src/utils/audioUtils.js
// ─────────────────────────────────────────────────────────────────────────────
// Audio utilities for real-time PCM16 WebSocket streaming.
//
// Exports:
//   • startStreamingMic(ws, onAudioLevel) → { stop() }
//       Opens the mic, downsamples to 16 kHz mono PCM16,
//       and sends 20 ms frames (320 samples) over the given WebSocket.
//
//   • getAudioLevel(analyser) → number (0-1)
//       Simple frequency-domain RMS for visualisation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze audio level from an AnalyserNode (useful for Orb animation).
 * @param {AnalyserNode} analyser
 * @returns {number} Normalised audio level 0‒1
 */
export const getAudioLevel = (analyser) => {
  if (!analyser) return 0;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  return Math.min(average / 128, 1);
};

/**
 * Start continuous microphone streaming over a WebSocket.
 *
 * Audio pipeline:
 *   mic (browser native rate, e.g. 48 kHz)
 *     → ScriptProcessorNode (buffer 4096)
 *       → downsample to 16 kHz
 *         → Float32 → Int16 (PCM16)
 *           → slice into 20 ms frames (320 samples = 640 bytes)
 *             → ws.send(frame.buffer)
 *
 * A leftover buffer is kept between `onaudioprocess` callbacks so that
 * partial frames are never lost.
 *
 * @param {WebSocket} ws          – An *already open* WebSocket in binary mode.
 * @param {Function}  onAudioLevel – Optional callback(level: 0‒1) per frame.
 * @returns {Promise<{stop: Function}>}
 */
export const startStreamingMic = async (ws, onAudioLevel) => {
  // ── 1. Acquire microphone stream ──────────────────────────────────────
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000, // hint — browsers may ignore this
    },
  });

  // ── 2. Create AudioContext (ideally at native rate for best quality) ──
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextCtor();

  // Resume if suspended (required after user gesture in some browsers)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const nativeRate = audioContext.sampleRate;
  const TARGET_RATE = 16000;
  const FRAME_SAMPLES = 320; // 20 ms @ 16 kHz

  console.log(
    `🎤 Mic opened — native ${nativeRate} Hz → resampling to ${TARGET_RATE} Hz`
  );

  // ── 3. Connect source → processor ────────────────────────────────────
  const source = audioContext.createMediaStreamSource(stream);

  // Use a 4096-sample buffer for smoother processing on all browsers
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioContext.destination); // required for onaudioprocess to fire

  // ── 4. Leftover buffer for frame alignment ───────────────────────────
  let leftover = new Int16Array(0);

  processor.onaudioprocess = (event) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const input = event.inputBuffer.getChannelData(0); // Float32Array

    // ── Compute audio level for visualisation ──
    if (typeof onAudioLevel === "function") {
      let sumSq = 0;
      for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
      const rms = Math.sqrt(sumSq / input.length);
      onAudioLevel(Math.min(rms * 6, 1)); // normalise to 0-1
    }

    // ── Downsample to 16 kHz ──
    const ratio = nativeRate / TARGET_RATE;
    const newLength = Math.floor(input.length / ratio);
    const downsampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      downsampled[i] = input[Math.floor(i * ratio)];
    }

    // ── Float32 → PCM16 ──
    const pcm16 = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // ── Merge with leftover from previous callback ──
    const merged = new Int16Array(leftover.length + pcm16.length);
    merged.set(leftover, 0);
    merged.set(pcm16, leftover.length);

    // ── Send exact 20 ms frames ──
    let offset = 0;
    while (offset + FRAME_SAMPLES <= merged.length) {
      const frame = merged.slice(offset, offset + FRAME_SAMPLES);
      ws.send(frame.buffer);
      offset += FRAME_SAMPLES;
    }

    // ── Keep any remaining samples for next callback ──
    leftover = merged.slice(offset);
  };

  // ── 5. Return a controller with stop() ───────────────────────────────
  return {
    stop: () => {
      try { processor.disconnect(); } catch (_) { /* already disconnected */ }
      try { source.disconnect(); } catch (_) { /* already disconnected */ }
      stream.getTracks().forEach((t) => t.stop());
      if (audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      console.log("🎤 Mic stopped & cleaned up");
    },
  };
};
