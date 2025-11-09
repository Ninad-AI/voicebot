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
