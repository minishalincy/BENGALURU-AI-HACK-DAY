import { useState, useRef, useCallback, useEffect } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface RecordingDB extends DBSchema {
  recordings: {
    key: string;
    value: {
      id: string;
      chunks: Blob[];
      timestamp: number;
      synced: boolean;
    };
  };
}

export interface UseOfflineRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  liveTranscript: string;
  analyser: AnalyserNode | null;
  isOnline: boolean;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<{ audioBlob: Blob | null; transcript: string }>;
  error: string | null;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

let db: IDBPDatabase<RecordingDB> | null = null;

async function getDB() {
  if (!db) {
    db = await openDB<RecordingDB>('creator-studio-recordings', 1, {
      upgrade(database) {
        database.createObjectStore('recordings', { keyPath: 'id' });
      },
    });
  }
  return db;
}

export function useOfflineRecorder(): UseOfflineRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');
  const recordingIdRef = useRef<string>('');

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save chunks to IndexedDB periodically for offline resilience
  const saveToIndexedDB = useCallback(async () => {
    if (chunksRef.current.length > 0 && recordingIdRef.current) {
      try {
        const database = await getDB();
        await database.put('recordings', {
          id: recordingIdRef.current,
          chunks: [...chunksRef.current],
          timestamp: Date.now(),
          synced: false,
        });
      } catch (e) {
        console.warn('Failed to save to IndexedDB:', e);
      }
    }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedDurationRef.current;
      setDuration(elapsed);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];
      pausedDurationRef.current = 0;
      setDuration(0);
      setLiveTranscript('');
      finalTranscriptRef.current = '';
      recordingIdRef.current = `recording_${Date.now()}`;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Save to IndexedDB every few chunks for offline resilience
          if (chunksRef.current.length % 5 === 0) {
            saveToIndexedDB();
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          if (final) {
            finalTranscriptRef.current += final;
          }

          setLiveTranscript(finalTranscriptRef.current + interim);
        };

        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech' && event.error !== 'network') {
            console.error('Speech recognition error:', event.error);
          }
        };

        recognition.onend = () => {
          if (isRecording && !isPaused && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please ensure microphone permissions are granted.');
    }
  }, [startTimer, isRecording, isPaused, saveToIndexedDB]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current = duration;
      setIsPaused(true);
      stopTimer();
      saveToIndexedDB();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  }, [duration, stopTimer, saveToIndexedDB]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      setIsPaused(false);
      startTimer();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    }
  }, [startTimer]);

  const stopRecording = useCallback(async (): Promise<{ audioBlob: Blob | null; transcript: string }> => {
    return new Promise(async (resolve) => {
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAnalyser(null);

      if (!mediaRecorderRef.current) {
        resolve({ audioBlob: null, transcript: finalTranscriptRef.current });
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Clean up IndexedDB entry
        try {
          const database = await getDB();
          await database.delete('recordings', recordingIdRef.current);
        } catch (e) {}

        chunksRef.current = [];

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        resolve({ audioBlob: blob, transcript: finalTranscriptRef.current });
      };

      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        resolve({ audioBlob: null, transcript: finalTranscriptRef.current });
      }
    });
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      stopTimer();
    };
  }, [stopTimer]);

  return {
    isRecording,
    isPaused,
    duration,
    liveTranscript,
    analyser,
    isOnline,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error,
  };
}
