/**
 * Notes Context
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { notesService, NoteListItem, FolderResponse, NoteDetailResponse, FolderReorderItem } from '@/services/notes';
import { Folder } from '@/data/types';

interface NotesContextType {
  notes: NoteListItem[];
  folders: FolderResponse[];
  isLoading: boolean;
  error: string | null;
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  fetchNotes: (folderId?: string) => Promise<void>;
  fetchFolders: () => Promise<void>;
  refreshAll: () => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  searchNotes: (query: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<boolean>;
  moveNote: (noteId: string, folderId: string) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  // Folder tree management
  reorderFolders: (updates: FolderReorderItem[]) => Promise<boolean>;
  nestFolder: (folderId: string, parentId: string | null) => Promise<boolean>;
  toggleFolderExpanded: (folderId: string) => void;
  buildFlattenedTree: () => Folder[];
  // Cache for newly created notes
  cacheNote: (note: NoteDetailResponse) => void;
  getCachedNote: (noteId: string) => NoteDetailResponse | null;
  clearCachedNote: (noteId: string) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  // Cache for newly created notes - use ref to avoid re-renders
  const noteCache = useRef<Map<string, NoteDetailResponse>>(new Map());

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
    // Clear existing notes to prevent showing stale data from another folder
    setNotes([]);
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
      noteCache.current.delete(noteId);
      fetchFolders();
    } else if (apiError) setError(apiError);
    return success;
  }, [fetchFolders]);

  const moveNote = useCallback(async (noteId: string, folderId: string) => {
    const { data, error: apiError } = await notesService.updateNote(noteId, { folder_id: folderId });
    if (data) {
      // Update local state
      setNotes(prev => prev.filter(n => n.id !== noteId));
      fetchFolders();
      return true;
    }
    if (apiError) setError(apiError);
    return false;
  }, [fetchFolders]);

  const deleteFolder = useCallback(async (folderId: string) => {
    const { success, error: apiError } = await notesService.deleteFolder(folderId);
    if (success) {
      // Remove folder and its children from the tree
      const removeFromTree = (folders: FolderResponse[]): FolderResponse[] => {
        return folders
          .filter(f => f.id !== folderId)
          .map(f => ({
            ...f,
            children: f.children ? removeFromTree(f.children) : [],
          }));
      };
      setFolders(prev => removeFromTree(prev));
      return true;
    }
    if (apiError) setError(apiError);
    return false;
  }, []);

  const reorderFolders = useCallback(async (updates: FolderReorderItem[]) => {
    const { success, error: apiError } = await notesService.reorderFolders(updates);
    if (success) {
      await fetchFolders();
      return true;
    }
    if (apiError) setError(apiError);
    return false;
  }, [fetchFolders]);

  const nestFolder = useCallback(async (folderId: string, parentId: string | null) => {
    const { data, error: apiError } = await notesService.updateNote(folderId, { folder_id: parentId as string });
    if (data) {
      await fetchFolders();
      return true;
    }
    if (apiError) setError(apiError);
    return false;
  }, [fetchFolders]);

  const toggleFolderExpanded = useCallback((folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Build flattened tree for display (respecting expanded state)
  const buildFlattenedTree = useCallback(() => {
    const convertFolder = (apiFolder: FolderResponse): Folder => ({
      id: apiFolder.id,
      name: apiFolder.name,
      icon: apiFolder.icon,
      noteCount: apiFolder.note_count,
      color: apiFolder.color || undefined,
      isSystem: apiFolder.is_system,
      sortOrder: apiFolder.sort_order,
      parentId: apiFolder.parent_id,
      depth: apiFolder.depth,
      children: apiFolder.children?.map(c => convertFolder(c)),
    });

    const flatten = (folders: FolderResponse[], depth: number = 0): Folder[] => {
      const result: Folder[] = [];
      for (const folder of folders) {
        const converted = convertFolder(folder);
        converted.depth = depth;
        result.push(converted);
        // Only add children if folder is expanded and has children
        if (folder.children && folder.children.length > 0 && expandedFolderIds.has(folder.id)) {
          result.push(...flatten(folder.children, depth + 1));
        }
      }
      return result;
    };

    return flatten(folders);
  }, [folders, expandedFolderIds]);

  // Cache functions for instant note display
  const cacheNote = useCallback((note: NoteDetailResponse) => {
    noteCache.current.set(note.id, note);
    // Auto-clear cache after 30 seconds
    setTimeout(() => {
      noteCache.current.delete(note.id);
    }, 30000);
  }, []);

  const getCachedNote = useCallback((noteId: string) => {
    return noteCache.current.get(noteId) || null;
  }, []);

  const clearCachedNote = useCallback((noteId: string) => {
    noteCache.current.delete(noteId);
  }, []);

  return (
    <NotesContext.Provider value={{ notes, folders, isLoading, error, selectedFolderId, expandedFolderIds, fetchNotes, fetchFolders, refreshAll, selectFolder, searchNotes, deleteNote, moveNote, deleteFolder, reorderFolders, nestFolder, toggleFolderExpanded, buildFlattenedTree, cacheNote, getCachedNote, clearCachedNote }}>
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
