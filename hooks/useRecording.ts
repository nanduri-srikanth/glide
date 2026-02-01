/**
 * useRecording Hook - Audio recording with expo-av
 * Includes Live Activity support for Dynamic Island
 * Supports offline-first recording with local storage
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { voiceService, VoiceProcessingResponse, SynthesisResponse } from '@/services/voice';
import { useLiveActivity } from './useLiveActivity';
import { audioStorageService } from '@/services/audio/AudioStorageService';
import { audioUploadManager } from '@/services/audio/AudioUploadManager';
import { notesRepository } from '@/services/repositories/NotesRepository';
import { syncEngine } from '@/services/sync';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
}

interface OfflineSaveResult {
  noteId: string;
  localAudioPath: string;
  uploadQueued: boolean;
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
  const [isOfflineSave, setIsOfflineSave] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live Activity for Dynamic Island
  const {
    startRecordingActivity,
    updateRecordingActivity,
    stopRecordingActivity,
    cancelRecordingActivity,
  } = useLiveActivity();

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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,  // Continue recording when app is backgrounded
      });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;

      setState(prev => ({ ...prev, isRecording: true, isPaused: false, duration: 0 }));
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start Live Activity for Dynamic Island
      await startRecordingActivity();
    } catch (err) {
      setError('Failed to start recording');
    }
  }, [startRecordingActivity]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) return null;
      if (timerRef.current) clearInterval(timerRef.current);

      const finalDuration = state.duration;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      recordingRef.current = null;
      setState(prev => ({ ...prev, isRecording: false, isPaused: false, uri }));

      // Stop Live Activity with final duration
      await stopRecordingActivity(finalDuration);

      return uri;
    } catch (err) {
      setError('Failed to stop recording');
      return null;
    }
  }, [state.duration, stopRecordingActivity]);

  const pauseRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.pauseAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      setState(prev => ({ ...prev, isPaused: true }));

      // Update Live Activity to show paused state
      await updateRecordingActivity(true, state.duration);
    } catch (err) {
      setError('Failed to pause recording');
    }
  }, [state.duration, updateRecordingActivity]);

  const resumeRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.startAsync();
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      setState(prev => ({ ...prev, isPaused: false }));

      // Update Live Activity to show recording state
      await updateRecordingActivity(false, state.duration);
    } catch (err) {
      setError('Failed to resume recording');
    }
  }, [state.duration, updateRecordingActivity]);

  const cancelRecording = useCallback(async () => {
    cleanup();
    setState({ isRecording: false, isPaused: false, duration: 0, uri: null });

    // Cancel Live Activity
    await cancelRecordingActivity();
  }, [cancelRecordingActivity]);

  /**
   * Save recording locally for offline use.
   * Creates a local note and queues the audio for upload when online.
   */
  const saveRecordingLocally = useCallback(async (
    folderId?: string,
    textInput?: string
  ): Promise<OfflineSaveResult | null> => {
    if (!state.uri) {
      setError('No recording to save');
      return null;
    }

    setIsOfflineSave(true);
    setIsProcessing(true);
    setProcessingProgress(10);
    setProcessingStatus('Saving recording locally...');

    try {
      // Generate a temporary note ID
      const tempNoteId = `offline_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      // Save audio to permanent storage
      setProcessingProgress(30);
      setProcessingStatus('Moving audio to permanent storage...');
      const permanentPath = await audioStorageService.moveAudio(state.uri, tempNoteId);

      // Get file info for size
      const fileInfo = await audioStorageService.getFileInfo(permanentPath);

      // Create local note
      setProcessingProgress(50);
      setProcessingStatus('Creating note...');
      const note = await notesRepository.createNote({
        title: textInput ? textInput.substring(0, 50) : 'Recording (processing...)',
        transcript: textInput || undefined,
        duration: state.duration,
        localAudioPath: permanentPath,
        folderId,
      });

      // Queue for server sync
      await syncEngine.queueOperation('note', note.id, 'create');

      // Queue audio for upload
      setProcessingProgress(70);
      setProcessingStatus('Queuing audio for upload...');
      await audioUploadManager.queueUpload({
        noteId: note.id,
        localPath: permanentPath,
        fileSize: fileInfo?.size,
      });

      setProcessingProgress(100);
      setProcessingStatus('Saved locally!');

      console.log(`[useRecording] Saved recording locally: ${note.id}, audio: ${permanentPath}`);

      return {
        noteId: note.id,
        localAudioPath: permanentPath,
        uploadQueued: true,
      };
    } catch (err) {
      console.error('[useRecording] Failed to save recording locally:', err);
      setError('Failed to save recording locally');
      return null;
    } finally {
      setIsProcessing(false);
      setIsOfflineSave(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  }, [state.uri, state.duration]);

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

      // Write-through: Store the server response in local DB
      if (data) {
        try {
          await notesRepository.upsertFromServer({
            id: data.note_id,
            title: data.title,
            transcript: data.transcript,
            summary: data.summary || undefined,
            duration: data.duration || state.duration,
            folderId: data.folder_id || folderId,
            tags: data.tags,
            createdAt: data.created_at,
            updatedAt: data.created_at, // VoiceProcessingResponse doesn't have updated_at
          });
          console.log('[useRecording] Stored processed note in local DB:', data.note_id);
        } catch (err) {
          console.error('[useRecording] Failed to store note in local DB:', err);
        }
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
  }, [state.uri, state.duration]);

  /**
   * Synthesize a note from the current recording and/or text input.
   * Uses the new synthesis endpoint that merges text + audio into a cohesive narrative.
   * Falls back to offline save if network is unavailable.
   */
  const synthesizeNote = useCallback(async (
    textInput?: string,
    folderId?: string,
    forceOffline?: boolean
  ): Promise<SynthesisResponse | null> => {
    // At least one of recording or text must be provided
    if (!state.uri && !textInput?.trim()) {
      setError('Please provide text or record audio');
      return null;
    }

    // If forcing offline save or only have text without audio
    if (forceOffline && state.uri) {
      const offlineResult = await saveRecordingLocally(folderId, textInput);
      if (offlineResult) {
        // Return a minimal response for offline save
        return {
          note_id: offlineResult.noteId,
          title: textInput?.substring(0, 50) || 'Recording (processing...)',
          narrative: textInput || '',
          raw_inputs: [],
          summary: null,
          duration: state.duration,
          folder_id: folderId || null,
          folder_name: '',
          tags: [],
          actions: { calendar: [], email: [], reminders: [], next_steps: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as SynthesisResponse;
      }
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
        // If network error, try to save offline
        if (apiError.includes('network') || apiError.includes('Network') || apiError.includes('fetch')) {
          console.log('[useRecording] Network error, falling back to offline save');
          setError(null);
          const offlineResult = await saveRecordingLocally(folderId, textInput);
          if (offlineResult) {
            return {
              note_id: offlineResult.noteId,
              title: textInput?.substring(0, 50) || 'Recording (processing...)',
              narrative: textInput || '',
              raw_inputs: [],
              summary: null,
              duration: state.duration,
              folder_id: folderId || null,
              folder_name: '',
              tags: [],
              actions: { calendar: [], email: [], reminders: [], next_steps: [] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as unknown as SynthesisResponse;
          }
        }
        setError(apiError);
        return null;
      }

      // Write-through: Store the server response in local DB
      if (data) {
        try {
          await notesRepository.upsertFromServer({
            id: data.note_id,
            title: data.title,
            transcript: data.narrative,
            summary: data.summary || undefined,
            duration: data.duration || state.duration,
            folderId: data.folder_id || folderId,
            tags: data.tags,
            createdAt: data.created_at,
            updatedAt: data.updated_at || data.created_at,
          });
          console.log('[useRecording] Stored synthesized note in local DB:', data.note_id);
        } catch (err) {
          console.error('[useRecording] Failed to store note in local DB:', err);
        }
      }

      return data || null;
    } catch (err) {
      // Try offline save on any error
      console.log('[useRecording] Error during synthesis, trying offline save');
      const offlineResult = await saveRecordingLocally(folderId, textInput);
      if (offlineResult) {
        return {
          note_id: offlineResult.noteId,
          title: textInput?.substring(0, 50) || 'Recording (processing...)',
          narrative: textInput || '',
          raw_inputs: [],
          summary: null,
          duration: state.duration,
          folder_id: folderId || null,
          folder_name: '',
          tags: [],
          actions: { calendar: [], email: [], reminders: [], next_steps: [] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as SynthesisResponse;
      }
      setError('Failed to synthesize note');
      return null;
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('');
    }
  }, [state.uri, saveRecordingLocally]);

  const resetState = useCallback(async () => {
    cleanup();
    setState({ isRecording: false, isPaused: false, duration: 0, uri: null });
    setError(null);
    setIsProcessing(false);
    setIsOfflineSave(false);

    // Cancel any active Live Activity
    await cancelRecordingActivity();
  }, [cancelRecordingActivity]);

  return {
    isRecording: state.isRecording,
    isPaused: state.isPaused,
    duration: state.duration,
    recordingUri: state.uri,
    isProcessing,
    processingProgress,
    processingStatus,
    error,
    isOfflineSave,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    processRecording,
    synthesizeNote,
    saveRecordingLocally,
    resetState,
  };
}

export default useRecording;
