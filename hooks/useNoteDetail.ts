/**
 * useNoteDetail Hook - Offline-first with local DB
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { notesService, NoteDetailResponse } from '@/services/notes';
import { actionsService, ActionExecuteResponse } from '@/services/actions';
import { voiceService, VoiceProcessingResponse, SynthesisResponse, InputHistoryEntry, UpdateDecision } from '@/services/voice';
import { Note } from '@/data/types';
import { useNotes } from '@/context/NotesContext';
import { notesRepository, localNoteToNote } from '@/services/repositories/NotesRepository';
import { useSync } from '@/context/SyncContext';
import { useNetwork } from '@/context/NetworkContext';

export function useNoteDetail(noteId: string | undefined) {
  const { getCachedNote, clearCachedNote } = useNotes();
  const { isInitialized, isHydrated } = useSync();
  const { isOnline } = useNetwork();
  const [rawNote, setRawNote] = useState<NoteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Append audio state
  const [isAppending, setIsAppending] = useState(false);
  const [appendProgress, setAppendProgress] = useState(0);
  const [appendStatus, setAppendStatus] = useState('');
  const [lastDecision, setLastDecision] = useState<UpdateDecision | null>(null);

  // Helper to store note in local DB
  const storeNoteLocally = useCallback(async (data: NoteDetailResponse) => {
    try {
      await notesRepository.upsertFromServer({
        id: data.id,
        title: data.title,
        transcript: data.transcript,
        summary: data.summary || undefined,
        duration: data.duration || undefined,
        folderId: data.folder_id || undefined,
        tags: data.tags,
        createdAt: data.created_at,
        updatedAt: data.updated_at || data.created_at,
      });
      console.log('[useNoteDetail] Stored note in local DB:', data.id);
    } catch (err) {
      console.error('[useNoteDetail] Failed to store note locally:', err);
    }
  }, []);

  const fetchNote = useCallback(async () => {
    if (!noteId) {
      setIsLoading(false);
      return;
    }

    // Check cache first for instant display
    const cached = getCachedNote(noteId);
    if (cached) {
      setRawNote(cached);
      setIsLoading(false);
      // Still fetch from API in background to get full data (e.g., actions)
      if (isOnline) {
        const { data } = await notesService.getNote(noteId);
        if (data) {
          setRawNote(data);
          clearCachedNote(noteId);
          // Write-through: store in local DB
          await storeNoteLocally(data);
        }
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    // Try local DB first if initialized
    if (isInitialized) {
      const localNote = await notesRepository.getNoteById(noteId);
      if (localNote) {
        // Convert local note to NoteDetailResponse format
        const localNoteDetail: NoteDetailResponse = {
          id: localNote.serverId || localNote.id,
          title: localNote.title,
          transcript: localNote.transcript || '',
          summary: localNote.summary || null,
          duration: localNote.duration ?? null,
          folder_id: localNote.folderId || null,
          folder_name: '',
          tags: localNote.tags,
          is_pinned: localNote.isPinned,
          is_archived: localNote.isArchived,
          ai_processed: true,
          audio_url: localNote.audioUrl || null,
          actions: [],
          ai_metadata: undefined,
          created_at: localNote.createdAt,
          updated_at: localNote.updatedAt,
        };
        setRawNote(localNoteDetail);
        setIsLoading(false);

        // If online, fetch from server in background for complete data (actions, etc.)
        if (isOnline) {
          const { data } = await notesService.getNote(noteId);
          if (data) {
            setRawNote(data);
            // Write-through: update local DB with full server data
            await storeNoteLocally(data);
          }
        }
        return;
      }
    }

    // Fetch from server if not found locally (or not initialized)
    if (isOnline) {
      const { data, error: apiError } = await notesService.getNote(noteId);
      if (apiError) setError(apiError);
      else if (data) {
        setRawNote(data);
        // Write-through: store in local DB
        await storeNoteLocally(data);
      }
    } else {
      setError('Note not available offline');
    }

    setIsLoading(false);
  }, [noteId, getCachedNote, clearCachedNote, isInitialized, isOnline, storeNoteLocally]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const refresh = useCallback(async () => {
    await fetchNote();
  }, [fetchNote]);

  const updateNote = useCallback(async (data: { title?: string; transcript?: string; tags?: string[] }): Promise<boolean> => {
    if (!noteId) return false;

    // Update local DB first
    if (isInitialized) {
      await notesRepository.updateNote(noteId, {
        title: data.title,
        transcript: data.transcript,
        tags: data.tags,
      });
      console.log('[useNoteDetail] Updated note in local DB:', noteId);
    }

    // If online, sync to server
    if (isOnline) {
      const { data: updated, error: apiError } = await notesService.updateNote(noteId, data);
      if (apiError) {
        console.warn('[useNoteDetail] Server update failed, will sync later:', apiError);
        // Don't set error - local update succeeded
      } else if (updated) {
        setRawNote(updated);
        // Write-through: update local DB with server response
        await storeNoteLocally(updated);
      }
    } else {
      // Offline - update UI state from local data
      setRawNote(prev => prev ? {
        ...prev,
        title: data.title ?? prev.title,
        transcript: data.transcript ?? prev.transcript,
        tags: data.tags ?? prev.tags,
      } : null);
    }

    return true;
  }, [noteId, isInitialized, isOnline, storeNoteLocally]);

  const deleteNote = useCallback(async (): Promise<boolean> => {
    if (!noteId) return false;

    // Delete locally first
    if (isInitialized) {
      await notesRepository.deleteNote(noteId);
      console.log('[useNoteDetail] Deleted note locally:', noteId);
    }

    // If online, sync to server
    if (isOnline) {
      const { success, error: apiError } = await notesService.deleteNote(noteId);
      if (apiError) {
        console.warn('[useNoteDetail] Server delete failed, will sync later:', apiError);
        // Don't set error - local delete succeeded
      }
      return success;
    }

    return true;
  }, [noteId, isInitialized, isOnline]);

  const executeAction = useCallback(async (actionId: string, service: 'google' | 'apple'): Promise<ActionExecuteResponse | null> => {
    const { data, error: apiError } = await actionsService.executeAction(actionId, service);
    if (apiError) {
      setError(apiError);
      return null;
    }
    await refresh();
    return data || null;
  }, [refresh]);

  const completeAction = useCallback(async (actionId: string): Promise<boolean> => {
    const { data, error: apiError } = await actionsService.completeAction(actionId);
    if (apiError) {
      setError(apiError);
      return false;
    }
    await refresh();
    return !!data;
  }, [refresh]);

  const appendAudio = useCallback(async (audioUri: string): Promise<boolean> => {
    if (!noteId) return false;

    setIsAppending(true);
    setAppendProgress(0);
    setAppendStatus('Starting...');

    const { data, error: apiError } = await voiceService.appendToNote(
      noteId,
      audioUri,
      (progress, status) => {
        setAppendProgress(progress);
        setAppendStatus(status);
      }
    );

    setIsAppending(false);
    setAppendProgress(0);
    setAppendStatus('');

    if (apiError) {
      setError(apiError);
      return false;
    }

    // Refresh note to get updated data
    await refresh();
    return true;
  }, [noteId, refresh]);

  /**
   * Add content to an existing note (text and/or audio).
   * Default behavior: transcribe and append (no AI re-synthesis).
   * User can explicitly set resynthesize=true to combine/summarize.
   */
  const addContent = useCallback(async (options: {
    textInput?: string;
    audioUri?: string;
    resynthesize?: boolean;
  }): Promise<boolean> => {
    if (!noteId) return false;

    setIsAppending(true);
    setAppendProgress(0);
    setAppendStatus('Starting...');
    setLastDecision(null);

    const { data, error: apiError } = await voiceService.addToNote(
      noteId,
      {
        ...options,
        autoDecide: false,  // Don't let AI auto-decide - user controls resynthesize explicitly
      },
      (progress, status) => {
        setAppendProgress(progress);
        setAppendStatus(status);
      }
    );

    setIsAppending(false);
    setAppendProgress(0);
    setAppendStatus('');

    if (apiError) {
      setError(apiError);
      return false;
    }

    // Track the decision made by smart synthesis
    if (data?.decision) {
      setLastDecision(data.decision);
    }

    // Refresh note to get updated data
    await refresh();
    return true;
  }, [noteId, refresh]);

  /**
   * Delete an input from the note's input history.
   * Triggers re-synthesis from remaining inputs.
   */
  const deleteInput = useCallback(async (inputIndex: number): Promise<boolean> => {
    if (!noteId) return false;

    setIsAppending(true);
    setAppendProgress(0);
    setAppendStatus('Deleting input...');

    const { data, error: apiError } = await voiceService.deleteInput(
      noteId,
      inputIndex,
      (progress, status) => {
        setAppendProgress(progress);
        setAppendStatus(status);
      }
    );

    setIsAppending(false);
    setAppendProgress(0);
    setAppendStatus('');

    if (apiError) {
      setError(apiError);
      return false;
    }

    // Refresh note to get updated data
    await refresh();
    return true;
  }, [noteId, refresh]);

  /**
   * Re-synthesize the note from its input history.
   * Useful after user edits when they want AI to regenerate the narrative.
   */
  const resynthesizeNote = useCallback(async (): Promise<boolean> => {
    if (!noteId) return false;

    setIsAppending(true);
    setAppendProgress(0);
    setAppendStatus('Re-synthesizing...');

    const { data, error: apiError } = await voiceService.resynthesizeNote(
      noteId,
      (progress, status) => {
        setAppendProgress(progress);
        setAppendStatus(status);
      }
    );

    setIsAppending(false);
    setAppendProgress(0);
    setAppendStatus('');

    if (apiError) {
      setError(apiError);
      return false;
    }

    // Refresh note to get updated data
    await refresh();
    return true;
  }, [noteId, refresh]);

  const note: Note | null = rawNote ? notesService.convertToNote(rawNote) : null;

  // Parse input history from AI metadata
  const inputHistory = useMemo((): InputHistoryEntry[] => {
    const history = rawNote?.ai_metadata?.input_history;
    if (!history || !Array.isArray(history)) return [];
    return history.map((entry: any) => ({
      type: entry.type as 'text' | 'audio',
      content: entry.content || '',
      timestamp: entry.timestamp || new Date().toISOString(),
      duration: entry.duration,
      audio_key: entry.audio_key,
    }));
  }, [rawNote?.ai_metadata?.input_history]);

  return {
    note,
    rawNote,
    isLoading,
    error,
    refresh,
    updateNote,
    deleteNote,
    executeAction,
    completeAction,
    appendAudio,
    addContent,
    deleteInput,
    resynthesizeNote,
    inputHistory,
    lastDecision,
    isAppending,
    appendProgress,
    appendStatus,
  };
}

export default useNoteDetail;
