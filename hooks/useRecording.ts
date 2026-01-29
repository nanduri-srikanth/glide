/**
 * useRecording Hook - Audio recording with expo-av
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { voiceService, VoiceProcessingResponse, SynthesisResponse } from '@/services/voice';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
}

export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    uri: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestPermissions();
    return () => cleanup();
  }, []);

  const requestPermissions = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) setError('Microphone permission is required');
    } catch (err) {
      setError('Failed to request permissions');
    }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;

      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } catch (err) {
      setError('Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) return null;
      if (timerRef.current) clearInterval(timerRef.current);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      recordingRef.current = null;
      setState(prev => ({ ...prev, isRecording: false, isPaused: false, uri }));
      return uri;
    } catch (err) {
      setError('Failed to stop recording');
      return null;
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.pauseAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      setState(prev => ({ ...prev, isPaused: true }));
    } catch (err) {
      setError('Failed to pause recording');
    }
  }, []);

  const resumeRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.startAsync();
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      setState(prev => ({ ...prev, isPaused: false }));
    } catch (err) {
      setError('Failed to resume recording');
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    cleanup();
    setState({ isRecording: false, isPaused: false, duration: 0, uri: null });
  }, []);

  const processRecording = useCallback(async (folderId?: string, userNotes?: string): Promise<VoiceProcessingResponse | null> => {
    if (!state.uri) {
      setError('No recording to process');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: apiError } = await voiceService.processVoiceMemo(
        state.uri,
        folderId,
        (progress, status) => {
          setProcessingProgress(progress);
          setProcessingStatus(status);
        },
        userNotes
      );

      if (apiError) {
        setError(apiError);
        return null;
      }
      return data || null;
    } catch (err) {
      setError('Failed to process recording');
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  }, [state.uri]);

  /**
   * Synthesize a note from the current recording and/or text input.
   * Uses the new synthesis endpoint that merges text + audio into a cohesive narrative.
   */
  const synthesizeNote = useCallback(async (
    textInput?: string,
    folderId?: string
  ): Promise<SynthesisResponse | null> => {
    // At least one of recording or text must be provided
    if (!state.uri && !textInput?.trim()) {
      setError('Please provide text or record audio');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: apiError } = await voiceService.synthesizeNote(
        {
          textInput: textInput?.trim() || undefined,
          audioUri: state.uri || undefined,
          folderId,
        },
        (progress, status) => {
          setProcessingProgress(progress);
          setProcessingStatus(status);
        }
      );

      if (apiError) {
        setError(apiError);
        return null;
      }
      return data || null;
    } catch (err) {
      setError('Failed to synthesize note');
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  }, [state.uri]);

  const resetState = useCallback(() => {
    cleanup();
    setState({ isRecording: false, isPaused: false, duration: 0, uri: null });
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    recordingUri: state.uri,
    isProcessing,
    processingProgress,
    processingStatus,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    processRecording,
    synthesizeNote,
    resetState,
  };
}

export default useRecording;
