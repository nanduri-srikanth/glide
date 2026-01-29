/**
 * useNoteDetail Hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { notesService, NoteDetailResponse } from '@/services/notes';
import { actionsService, ActionExecuteResponse } from '@/services/actions';
import { voiceService, VoiceProcessingResponse, SynthesisResponse, InputHistoryEntry, UpdateDecision } from '@/services/voice';
import { Note } from '@/data/types';
import { useNotes } from '@/context/NotesContext';

export function useNoteDetail(noteId: string | undefined) {
  const { getCachedNote, clearCachedNote } = useNotes();
  const [rawNote, setRawNote] = useState<NoteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Append audio state
  const [isAppending, setIsAppending] = useState(false);
  const [appendProgress, setAppendProgress] = useState(0);
  const [appendStatus, setAppendStatus] = useState('');
  const [lastDecision, setLastDecision] = useState<UpdateDecision | null>(null);

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
      const { data } = await notesService.getNote(noteId);
      if (data) {
        setRawNote(data);
        clearCachedNote(noteId);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: apiError } = await notesService.getNote(noteId);
    if (apiError) setError(apiError);
    else if (data) setRawNote(data);

    setIsLoading(false);
  }, [noteId, getCachedNote, clearCachedNote]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  const refresh = useCallback(async () => {
    await fetchNote();
  }, [fetchNote]);

  const updateNote = useCallback(async (data: { title?: string; transcript?: string; tags?: string[] }): Promise<boolean> => {
    if (!noteId) return false;
    const { data: updated, error: apiError } = await notesService.updateNote(noteId, data);
    if (apiError) {
      setError(apiError);
      return false;
    }
    if (updated) setRawNote(updated);
    return true;
  }, [noteId]);

  const deleteNote = useCallback(async (): Promise<boolean> => {
    if (!noteId) return false;
    const { success, error: apiError } = await notesService.deleteNote(noteId);
    if (apiError) setError(apiError);
    return success;
  }, [noteId]);

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
   * Uses the new synthesis endpoint for intelligent merging.
   */
  const addContent = useCallback(async (options: {
    textInput?: string;
    audioUri?: string;
    resynthesize?: boolean;
    autoDecide?: boolean;
  }): Promise<boolean> => {
    if (!noteId) return false;

    setIsAppending(true);
    setAppendProgress(0);
    setAppendStatus('Starting...');
    setLastDecision(null);

    const { data, error: apiError } = await voiceService.addToNote(
      noteId,
      options,
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
