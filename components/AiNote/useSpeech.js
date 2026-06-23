import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A custom React hook for browser-native speech-to-text recognition
 * and live microphone volume tracking.
 */
export default function useSpeech(initialLang = 'zh-CN') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0);
  const [lang, setLang] = useState(initialLang);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Initialize Speech Recognition API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Web Speech API is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = lang;

    rec.onstart = () => {
      setIsListening(true);
      setError('');
    };

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += chunk;
        } else {
          interimText += chunk;
        }
      }

      if (finalText) {
        setTranscript(prev => prev + (prev ? ' ' : '') + finalText);
      }
      setInterimTranscript(interimText);
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please check your browser permissions.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
      stopAudioAnalysis();
    };

    rec.onend = () => {
      setIsListening(false);
      stopAudioAnalysis();
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioAnalysis();
    };
  }, [lang]);

  // Start real-time audio amplitude analysis
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sum up high-amplitude levels
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Scale to 0-100
        const vol = Math.min(100, Math.round((average / 128) * 100));
        setVolume(vol);

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Could not start microphone audio level meter:', err);
    }
  };

  // Stop audio analysis and release stream
  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolume(0);
  };

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setError('');
      recognitionRef.current.start();
      startAudioAnalysis();
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      stopAudioAnalysis();
    } catch (err) {
      console.error('Failed to stop recognition:', err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    volume,
    lang,
    setLang,
    startListening,
    stopListening,
    resetTranscript,
  };
}
