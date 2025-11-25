/**
 * Audio utility functions for recording and processing
 */

let mediaRecorder = null;
let audioChunks = [];

/**
 * Start recording audio from the user's microphone
 * @returns {Promise<{mediaRecorder: MediaRecorder, audioContext: AudioContext, analyser: AnalyserNode}>}
 */
export const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } 
    });

    // Create audio context for visualization
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Setup media recorder
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start();

    return { mediaRecorder, audioContext, analyser };
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw error;
  }
};

/**
 * Stop recording and return the audio blob
 * @param {MediaRecorder} recorder - The media recorder instance
 * @param {AudioContext} audioContext - The audio context to close
 * @returns {Promise<Blob>}
 */
export const stopRecording = (recorder, audioContext) => {
  return new Promise((resolve) => {
    if (!recorder) {
      resolve(null);
      return;
    }

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];
      
      // Stop all tracks
      recorder.stream.getTracks().forEach(track => track.stop());
      
      // Close audio context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      
      resolve(audioBlob);
    };

    recorder.stop();
  });
};

/**
 * Convert audio blob to base64 string
 * @param {Blob} blob - The audio blob
 * @returns {Promise<string>}
 */
export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Analyze audio level from analyser node
 * @param {AnalyserNode} analyser - The audio analyser
 * @returns {number} Normalized audio level (0-1)
 */
export const getAudioLevel = (analyser) => {
  if (!analyser) return 0;
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  return Math.min(average / 128, 1);
};


/**
 * Record a single utterance using simple energy-based VAD.
 *
 * Behaviour:
 *  - Starts listening immediately
 *  - If user speaks: record until trailing silence, then return Blob
 *  - If user never speaks for noInputTimeoutMs: return null
 */
export const recordUtteranceWithVAD = async ({
                                                 maxDurationMs = 30000,
                                                 energyThreshold = 0.01,
                                                 silenceAfterSpeechMs = 600,
                                                 noInputTimeoutMs = 5000,
                                                 onAudioLevel,
                                             } = {}) => {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
    });

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    };
    // small timeslice so we flush data regularly
    recorder.start(100);

    const dataArray = new Uint8Array(analyser.fftSize);
    const startTime = performance.now();

    let speechStarted = false;
    let lastSpeechTime = null;

    let noiseSum = 0;
    let noiseCount = 0;

    return new Promise((resolve, reject) => {
        const cleanup = () => {
            try {
                stream.getTracks().forEach((t) => t.stop());
            } catch (_) {}
            if (audioContext && audioContext.state !== "closed") {
                audioContext.close();
            }
        };

        const finishWithBlob = () => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                cleanup();
                resolve(blob);
            };
            try {
                recorder.stop();
            } catch (err) {
                cleanup();
                reject(err);
            }
        };

        const finishNoSpeech = () => {
            cleanup();
            resolve(null);
        };

        const tick = () => {
            const now = performance.now();
            const elapsed = now - startTime;

            analyser.getByteTimeDomainData(dataArray);
            let sumSquares = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const v = (dataArray[i] - 128) / 128; // -1..1
                sumSquares += v * v;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length); // 0..~1

            if (typeof onAudioLevel === "function") {
                const normalized = Math.min(rms * 8, 1); // boost into 0..1
                onAudioLevel(normalized);
            }

            // Dynamic threshold from first 0.5s of noise
            if (!speechStarted && elapsed < 500) {
                noiseSum += rms;
                noiseCount += 1;
            }

            let threshold = energyThreshold;
            if (!speechStarted && noiseCount > 0) {
                const estNoise = noiseSum / noiseCount;
                threshold = Math.max(threshold, estNoise * 3.0);
            }

            if (rms >= threshold) {
                speechStarted = true;
                lastSpeechTime = now;
            }

            // Global "no speech at all" timeout
            if (!speechStarted && elapsed >= noInputTimeoutMs) {
                finishNoSpeech();
                return;
            }

            if (speechStarted) {
                if (rms >= threshold) {
                    lastSpeechTime = now;
                }

                const silenceElapsed = now - lastSpeechTime;
                if (
                    silenceElapsed >= silenceAfterSpeechMs ||
                    elapsed >= maxDurationMs
                ) {
                    finishWithBlob();
                    return;
                }
            }

            requestAnimationFrame(tick);
        };

        tick();
    });
};
