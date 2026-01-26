/**
 * Notes Context
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { notesService, NoteListItem, FolderResponse } from '@/services/notes';

interface NotesContextType {
  notes: NoteListItem[];
  folders: FolderResponse[];
  isLoading: boolean;
  error: string | null;
  selectedFolderId: string | null;
  fetchNotes: (folderId?: string) => Promise<void>;
  fetchFolders: () => Promise<void>;
  refreshAll: () => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  searchNotes: (query: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<boolean>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: apiError } = await notesService.listFolders();
    if (apiError) setError(apiError);
    else if (data) setFolders(data);
    setIsLoading(false);
  }, []);

  const fetchNotes = useCallback(async (folderId?: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error: apiError } = await notesService.listNotes({ folder_id: folderId, per_page: 50 });
    if (apiError) setError(apiError);
    else if (data) setNotes(data.items);
    setIsLoading(false);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchFolders(), fetchNotes(selectedFolderId || undefined)]);
  }, [fetchFolders, fetchNotes, selectedFolderId]);

  const selectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const searchNotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      await fetchNotes(selectedFolderId || undefined);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: apiError } = await notesService.searchNotes(query);
    if (apiError) setError(apiError);
    else if (data) setNotes(data.items);
    setIsLoading(false);
  }, [selectedFolderId, fetchNotes]);

  const deleteNote = useCallback(async (noteId: string) => {
    const { success, error: apiError } = await notesService.deleteNote(noteId);
    if (success) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      fetchFolders();
    } else if (apiError) setError(apiError);
    return success;
  }, [fetchFolders]);

  return (
    <NotesContext.Provider value={{ notes, folders, isLoading, error, selectedFolderId, fetchNotes, fetchFolders, refreshAll, selectFolder, searchNotes, deleteNote }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) throw new Error('useNotes must be used within a NotesProvider');
  return context;
}

export default NotesContext;
