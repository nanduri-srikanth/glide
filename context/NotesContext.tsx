/**
 * Notes Context - Offline-first with local database
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { notesService, NoteListItem, FolderResponse, NoteDetailResponse, FolderReorderItem } from '@/services/notes';
import { Folder } from '@/data/types';
import { notesRepository, LocalNote, localNoteToNote } from '@/services/repositories/NotesRepository';
import { foldersRepository, LocalFolder, localFolderToFolder } from '@/services/repositories/FoldersRepository';
import { actionsRepository } from '@/services/repositories/ActionsRepository';
import { syncEngine } from '@/services/sync';
import { useSync } from './SyncContext';
import { useNetwork } from './NetworkContext';

// Convert LocalNote to NoteListItem format for compatibility
function localNoteToListItem(note: LocalNote): NoteListItem {
  return {
    id: note.serverId || note.id,
    title: note.title,
    preview: note.transcript?.substring(0, 100) || '',
    duration: note.duration,
    folder_id: note.folderId,
    tags: note.tags,
    is_pinned: note.isPinned,
    action_count: 0, // Will be populated separately if needed
    calendar_count: 0,
    email_count: 0,
    reminder_count: 0,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

// Convert LocalFolder to FolderResponse format for compatibility
function localFolderToResponse(folder: LocalFolder, noteCount: number = 0, children: FolderResponse[] = []): FolderResponse {
  return {
    id: folder.serverId || folder.id,
    name: folder.name,
    icon: folder.icon || 'folder',
    color: folder.color,
    is_system: folder.isSystem,
    note_count: noteCount,
    sort_order: folder.sortOrder,
    parent_id: folder.parentId,
    depth: folder.depth,
    children,
    created_at: folder.localUpdatedAt,
  };
}

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
  // Offline support
  createNoteLocally: (input: { title?: string; transcript?: string; folderId?: string; localAudioPath?: string }) => Promise<LocalNote>;
  updateNoteLocally: (noteId: string, updates: { title?: string; transcript?: string; folderId?: string }) => Promise<boolean>;
  // Store server response in local DB (write-through)
  storeNoteFromServer: (note: { id: string; title: string; narrative?: string; summary?: string; duration?: number; folder_id?: string | null; tags?: string[]; created_at?: string; updated_at?: string }) => Promise<void>;
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
  // Track which folder the current notes belong to
  const currentNotesFolderId = useRef<string | undefined>(undefined);

  // Get sync and network context
  const { isInitialized, isHydrated } = useSync();
  const { isOnline } = useNetwork();

  // Load notes from local database
  const fetchNotesFromLocal = useCallback(async (folderId?: string) => {
    try {
      const localNotes = await notesRepository.getAllNotes(folderId);
      const noteItems = localNotes.map(localNoteToListItem);
      setNotes(noteItems);
    } catch (error) {
      console.error('[NotesContext] Failed to fetch notes from local DB:', error);
    }
  }, []);

  // Load folders from local database
  const fetchFoldersFromLocal = useCallback(async () => {
    try {
      const localFolders = await foldersRepository.getAllFolders();

      // Build folder tree structure
      const folderMap = new Map<string | null, LocalFolder[]>();
      for (const folder of localFolders) {
        const parentId = folder.parentId;
        if (!folderMap.has(parentId)) {
          folderMap.set(parentId, []);
        }
        folderMap.get(parentId)!.push(folder);
      }

      // Recursively build tree
      const buildTree = (parentId: string | null): FolderResponse[] => {
        const children = folderMap.get(parentId) || [];
        return children
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(folder => localFolderToResponse(folder, 0, buildTree(folder.serverId || folder.id)));
      };

      const folderTree = buildTree(null);
      setFolders(folderTree);
    } catch (error) {
      console.error('[NotesContext] Failed to fetch folders from local DB:', error);
    }
  }, []);

  // Fetch notes - try local first, then optionally sync from server
  const fetchNotes = useCallback(async (folderId?: string) => {
    setIsLoading(true);
    setError(null);

    // If switching to a different folder, clear notes immediately
    if (currentNotesFolderId.current !== folderId) {
      setNotes([]);
      currentNotesFolderId.current = folderId;
    }

    // If initialized, fetch from local DB first
    if (isInitialized) {
      await fetchNotesFromLocal(folderId);
    }

    // If online and hydrated, also fetch from server for fresh data
    if (isOnline && isHydrated) {
      try {
        const { data, error: apiError } = await notesService.listNotes({ folder_id: folderId, per_page: 50 });
        if (apiError) {
          console.warn('[NotesContext] API fetch failed, using local data:', apiError);
        } else if (data) {
          setNotes(data.items);
          // Update local DB in background
          for (const note of data.items) {
            await notesRepository.upsertFromServer({
              id: note.id,
              title: note.title,
              folderId: note.folder_id || undefined,
              tags: note.tags,
              duration: note.duration || undefined,
              createdAt: note.created_at,
              updatedAt: note.updated_at || note.created_at,
            });
          }
        }
      } catch (err) {
        console.warn('[NotesContext] API fetch failed, using local data');
      }
    }

    setIsLoading(false);
  }, [isInitialized, isOnline, isHydrated, fetchNotesFromLocal]);

  // Fetch folders - try local first, then optionally sync from server
  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // If initialized, fetch from local DB first
    if (isInitialized) {
      await fetchFoldersFromLocal();
    }

    // If online and hydrated, also fetch from server
    if (isOnline && isHydrated) {
      try {
        const { data, error: apiError } = await notesService.listFolders();
        if (apiError) {
          console.warn('[NotesContext] API folder fetch failed, using local data:', apiError);
        } else if (data) {
          setFolders(data);
          // Write-through: Store server folders in local DB
          const storeFolder = async (folder: FolderResponse) => {
            await foldersRepository.upsertFromServer({
              id: folder.id,
              name: folder.name,
              icon: folder.icon,
              color: folder.color || undefined,
              isSystem: folder.is_system,
              sortOrder: folder.sort_order,
              parentId: folder.parent_id || undefined,
              depth: folder.depth,
              updatedAt: folder.created_at || new Date().toISOString(),
            });
            // Recursively store children
            if (folder.children) {
              for (const child of folder.children) {
                await storeFolder(child);
              }
            }
          };
          for (const folder of data) {
            await storeFolder(folder);
          }
          console.log('[NotesContext] Stored', data.length, 'folders in local DB');
        }
      } catch (err) {
        console.warn('[NotesContext] API folder fetch failed, using local data');
      }
    }

    setIsLoading(false);
  }, [isInitialized, isOnline, isHydrated, fetchFoldersFromLocal]);

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

    // Search local database first
    if (isInitialized) {
      try {
        const localResults = await notesRepository.searchNotes(query);
        setNotes(localResults.map(localNoteToListItem));
      } catch (error) {
        console.error('[NotesContext] Local search failed:', error);
      }
    }

    // Also search server if online
    if (isOnline) {
      try {
        const { data, error: apiError } = await notesService.searchNotes(query);
        if (!apiError && data) {
          setNotes(data.items);
        }
      } catch (err) {
        console.warn('[NotesContext] API search failed, using local results');
      }
    }

    setIsLoading(false);
  }, [selectedFolderId, fetchNotes, isInitialized, isOnline]);

  const deleteNote = useCallback(async (noteId: string) => {
    // Delete locally first
    if (isInitialized) {
      const success = await notesRepository.deleteNote(noteId);
      if (success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        noteCache.current.delete(noteId);

        // Queue for server sync
        await syncEngine.queueOperation('note', noteId, 'delete');

        // Try to sync to server immediately if online
        if (isOnline) {
          try {
            await notesService.deleteNote(noteId);
          } catch (err) {
            console.warn('[NotesContext] Server delete failed, will sync later');
          }
        }

        fetchFolders();
        return true;
      }
    } else if (isOnline) {
      // Fallback to direct API call if not initialized
      const { success, error: apiError } = await notesService.deleteNote(noteId);
      if (success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        noteCache.current.delete(noteId);
        fetchFolders();
      } else if (apiError) setError(apiError);
      return success;
    }

    return false;
  }, [isInitialized, isOnline, fetchFolders]);

  const moveNote = useCallback(async (noteId: string, folderId: string) => {
    // Update locally first
    if (isInitialized) {
      const success = await notesRepository.updateNote(noteId, { folderId });
      if (success) {
        setNotes(prev => prev.filter(n => n.id !== noteId));

        // Queue for server sync
        await syncEngine.queueOperation('note', noteId, 'update', { folderId });

        // Try to sync to server immediately if online
        if (isOnline) {
          try {
            await notesService.updateNote(noteId, { folder_id: folderId });
          } catch (err) {
            console.warn('[NotesContext] Server move failed, will sync later');
          }
        }

        fetchFolders();
        return true;
      }
    } else if (isOnline) {
      // Fallback to direct API call
      const { data, error: apiError } = await notesService.updateNote(noteId, { folder_id: folderId });
      if (data) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        fetchFolders();
        return true;
      }
      if (apiError) setError(apiError);
    }

    return false;
  }, [isInitialized, isOnline, fetchFolders]);

  const deleteFolder = useCallback(async (folderId: string) => {
    // Delete locally first
    if (isInitialized) {
      const success = await foldersRepository.deleteFolder(folderId);
      if (success) {
        // Remove folder from state
        const removeFromTree = (folders: FolderResponse[]): FolderResponse[] => {
          return folders
            .filter(f => f.id !== folderId)
            .map(f => ({
              ...f,
              children: f.children ? removeFromTree(f.children) : [],
            }));
        };
        setFolders(prev => removeFromTree(prev));

        // Queue for server sync
        await syncEngine.queueOperation('folder', folderId, 'delete');

        // Try to sync to server immediately if online
        if (isOnline) {
          try {
            await notesService.deleteFolder(folderId);
          } catch (err) {
            console.warn('[NotesContext] Server folder delete failed, will sync later');
          }
        }

        return true;
      }
    } else if (isOnline) {
      // Fallback to direct API call
      const { success, error: apiError } = await notesService.deleteFolder(folderId);
      if (success) {
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
    }

    return false;
  }, [isInitialized, isOnline]);

  const reorderFolders = useCallback(async (updates: FolderReorderItem[]) => {
    // Update locally first
    if (isInitialized) {
      await foldersRepository.reorderFolders(updates.map(u => ({
        id: u.id,
        sortOrder: u.sort_order,
        parentId: u.parent_id || undefined,
      })));

      // Queue for server sync
      for (const update of updates) {
        await syncEngine.queueOperation('folder', update.id, 'update', {
          sortOrder: update.sort_order,
          parentId: update.parent_id,
        });
      }
    }

    // Sync to server if online
    if (isOnline) {
      const { success, error: apiError } = await notesService.reorderFolders(updates);
      if (!success && apiError) {
        console.warn('[NotesContext] Server reorder failed, will sync later:', apiError);
      }
    }

    await fetchFolders();
    return true;
  }, [isInitialized, isOnline, fetchFolders]);

  const nestFolder = useCallback(async (folderId: string, parentId: string | null) => {
    // Update locally first
    if (isInitialized) {
      await foldersRepository.updateFolder(folderId, { parentId });

      // Queue for server sync
      await syncEngine.queueOperation('folder', folderId, 'update', { parentId });
    }

    // Sync to server if online
    if (isOnline) {
      const { data, error: apiError } = await notesService.updateFolder(folderId, { parent_id: parentId });
      if (!data && apiError) {
        console.warn('[NotesContext] Server nest failed, will sync later:', apiError);
      }
    }

    await fetchFolders();
    return true;
  }, [isInitialized, isOnline, fetchFolders]);

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
    // Auto-clear cache after 5 minutes
    setTimeout(() => {
      noteCache.current.delete(note.id);
    }, 300000);
  }, []);

  const getCachedNote = useCallback((noteId: string) => {
    return noteCache.current.get(noteId) || null;
  }, []);

  const clearCachedNote = useCallback((noteId: string) => {
    noteCache.current.delete(noteId);
  }, []);

  // Create a note locally (for offline support)
  const createNoteLocally = useCallback(async (input: {
    title?: string;
    transcript?: string;
    folderId?: string;
    localAudioPath?: string;
  }): Promise<LocalNote> => {
    const note = await notesRepository.createNote({
      title: input.title,
      transcript: input.transcript,
      folderId: input.folderId,
      localAudioPath: input.localAudioPath,
    });

    // Queue for server sync
    await syncEngine.queueOperation('note', note.id, 'create');

    // Update UI
    const listItem = localNoteToListItem(note);
    setNotes(prev => [listItem, ...prev]);

    console.log('[NotesContext] Created local note:', note.id);
    return note;
  }, []);

  // Update a note locally (for offline support)
  const updateNoteLocally = useCallback(async (noteId: string, updates: {
    title?: string;
    transcript?: string;
    folderId?: string;
  }): Promise<boolean> => {
    const note = await notesRepository.updateNote(noteId, updates);
    if (!note) return false;

    // Queue for server sync
    await syncEngine.queueOperation('note', noteId, 'update', updates);

    // Update UI
    const listItem = localNoteToListItem(note);
    setNotes(prev => prev.map(n => n.id === noteId ? listItem : n));

    console.log('[NotesContext] Updated local note:', noteId);
    return true;
  }, []);

  // Store a note from server response in local DB (write-through caching)
  const storeNoteFromServer = useCallback(async (note: {
    id: string;
    title: string;
    narrative?: string;
    summary?: string;
    duration?: number;
    folder_id?: string | null;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
  }): Promise<void> => {
    try {
      await notesRepository.upsertFromServer({
        id: note.id,
        title: note.title,
        transcript: note.narrative,
        summary: note.summary,
        duration: note.duration,
        folderId: note.folder_id || undefined,
        tags: note.tags,
        createdAt: note.created_at || new Date().toISOString(),
        updatedAt: note.updated_at || note.created_at || new Date().toISOString(),
      });

      // Also add to notes list if current folder matches
      const listItem: NoteListItem = {
        id: note.id,
        title: note.title,
        preview: note.narrative?.substring(0, 100) || '',
        duration: note.duration ?? null,
        folder_id: note.folder_id ?? null,
        tags: note.tags || [],
        is_pinned: false,
        action_count: 0,
        calendar_count: 0,
        email_count: 0,
        reminder_count: 0,
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || note.created_at || new Date().toISOString(),
      };

      // Add to the beginning of the notes list
      setNotes(prev => {
        // Check if note already exists
        const existingIndex = prev.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
          // Update existing
          const updated = [...prev];
          updated[existingIndex] = listItem;
          return updated;
        }
        // Add to beginning
        return [listItem, ...prev];
      });

      console.log('[NotesContext] Stored server note in local DB:', note.id);
    } catch (error) {
      console.error('[NotesContext] Failed to store note from server:', error);
    }
  }, []);

  // Initial data load when initialized
  useEffect(() => {
    if (isInitialized) {
      fetchFoldersFromLocal();
      fetchNotesFromLocal(selectedFolderId || undefined);
    }
  }, [isInitialized, selectedFolderId, fetchFoldersFromLocal, fetchNotesFromLocal]);

  return (
    <NotesContext.Provider value={{
      notes,
      folders,
      isLoading,
      error,
      selectedFolderId,
      expandedFolderIds,
      fetchNotes,
      fetchFolders,
      refreshAll,
      selectFolder,
      searchNotes,
      deleteNote,
      moveNote,
      deleteFolder,
      reorderFolders,
      nestFolder,
      toggleFolderExpanded,
      buildFlattenedTree,
      cacheNote,
      getCachedNote,
      clearCachedNote,
      createNoteLocally,
      updateNoteLocally,
      storeNoteFromServer,
    }}>
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
