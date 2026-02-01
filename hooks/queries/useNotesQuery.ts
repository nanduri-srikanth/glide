/**
 * Notes Query Hooks
 *
 * TanStack Query hooks for fetching and mutating notes.
 * Implements SWR pattern with cache invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import {
  notesService,
  NoteListResponse,
  NoteDetailResponse,
  NoteFilters,
  UnifiedSearchResponse,
} from '@/services/notes';

// ============ QUERIES ============

/**
 * Fetch list of notes with optional filters
 */
export function useNotesListQuery(filters: NoteFilters = {}) {
  return useQuery({
    queryKey: queryKeys.notes.list(filters),
    queryFn: async () => {
      const { data, error } = await notesService.listNotes(filters);
      if (error) throw new Error(error);
      return data!;
    },
    // Keep previous data while fetching with new filters
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Fetch a single note by ID
 */
export function useNoteDetailQuery(noteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notes.detail(noteId || ''),
    queryFn: async () => {
      if (!noteId) throw new Error('Note ID is required');
      const { data, error } = await notesService.getNote(noteId);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: !!noteId,
  });
}

/**
 * Search notes
 */
export function useNotesSearchQuery(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.notes.search(query),
    queryFn: async () => {
      const { data, error } = await notesService.searchNotes(query);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: enabled && query.length > 0,
    // Shorter stale time for search results
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Unified search (notes + folders)
 */
export function useUnifiedSearchQuery(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.search.unified(query),
    queryFn: async () => {
      const { data, error } = await notesService.unifiedSearch(query);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: enabled && query.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// ============ MUTATIONS ============

/**
 * Create a new note
 */
export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      transcript: string;
      folder_id?: string;
      tags?: string[];
    }) => {
      const { data: note, error } = await notesService.createNote(data);
      if (error) throw new Error(error);
      return note!;
    },
    onSuccess: (newNote) => {
      // Invalidate notes list to show the new note
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      // Invalidate folders to update note counts
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
      // Pre-populate the detail cache
      queryClient.setQueryData(queryKeys.notes.detail(newNote.id), newNote);
    },
  });
}

/**
 * Update an existing note
 */
export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      data,
    }: {
      noteId: string;
      data: {
        title?: string;
        transcript?: string;
        folder_id?: string;
        tags?: string[];
        is_pinned?: boolean;
        is_archived?: boolean;
      };
    }) => {
      const { data: note, error } = await notesService.updateNote(noteId, data);
      if (error) throw new Error(error);
      return note!;
    },
    onSuccess: (updatedNote, { noteId }) => {
      // Update the detail cache
      queryClient.setQueryData(queryKeys.notes.detail(noteId), updatedNote);
      // Invalidate lists to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      // Invalidate folders if folder changed
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      permanent = false,
    }: {
      noteId: string;
      permanent?: boolean;
    }) => {
      const { success, error } = await notesService.deleteNote(noteId, permanent);
      if (error) throw new Error(error);
      return { noteId, success };
    },
    onSuccess: ({ noteId }) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: queryKeys.notes.detail(noteId) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      // Invalidate folders to update note counts
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

/**
 * Auto-sort note into appropriate folder
 */
export function useAutoSortNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { data, error } = await notesService.autoSortNote(noteId);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (updatedNote, noteId) => {
      // Update detail cache
      queryClient.setQueryData(queryKeys.notes.detail(noteId), updatedNote);
      // Invalidate lists and folders
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
    },
  });
}

// ============ HELPERS ============

/**
 * Hook to prefetch a note detail
 */
export function usePrefetchNoteDetail() {
  const queryClient = useQueryClient();

  return (noteId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.notes.detail(noteId),
      queryFn: async () => {
        const { data, error } = await notesService.getNote(noteId);
        if (error) throw new Error(error);
        return data!;
      },
    });
  };
}

export default useNotesListQuery;
