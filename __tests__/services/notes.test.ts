/**
 * Unit tests for Notes service
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios || options.default),
  },
}));

// Mock the api module
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from '../../services/api';
import { notesService, NoteDetailResponse, ActionResponse, FolderResponse } from '../../services/notes';

describe('NotesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listNotes', () => {
    it('should fetch notes without filters', async () => {
      const mockResponse = {
        items: [{ id: '1', title: 'Test Note' }],
        total: 1,
        page: 1,
        per_page: 20,
        pages: 1,
      };

      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await notesService.listNotes();

      expect(result.data).toEqual(mockResponse);
      expect(api.get).toHaveBeenCalledWith('/notes');
    });

    it('should apply filters to query string', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });

      await notesService.listNotes({
        folder_id: 'folder-1',
        q: 'search term',
        is_pinned: true,
        page: 2,
        per_page: 10,
      });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/folder_id=folder-1/)
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/q=search\+term/)
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringMatching(/is_pinned=true/)
      );
    });

    it('should handle errors', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        error: { status: 500, message: 'Server error' },
      });

      const result = await notesService.listNotes();

      expect(result.error).toBe('Server error');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getNote', () => {
    it('should fetch a single note by ID', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        transcript: 'Test content',
        actions: [],
      };

      (api.get as jest.Mock).mockResolvedValueOnce({ data: mockNote });

      const result = await notesService.getNote('note-1');

      expect(result.data).toEqual(mockNote);
      expect(api.get).toHaveBeenCalledWith('/notes/note-1');
    });

    it('should handle not found errors', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        error: { status: 404, message: 'Note not found' },
      });

      const result = await notesService.getNote('invalid-id');

      expect(result.error).toBe('Note not found');
    });
  });

  describe('createNote', () => {
    it('should create a new note', async () => {
      const newNote = {
        id: 'new-note',
        title: 'New Note',
        transcript: 'Content',
        actions: [],
      };

      (api.post as jest.Mock).mockResolvedValueOnce({ data: newNote });

      const result = await notesService.createNote({
        title: 'New Note',
        transcript: 'Content',
      });

      expect(result.data).toEqual(newNote);
      expect(api.post).toHaveBeenCalledWith('/notes', {
        title: 'New Note',
        transcript: 'Content',
      });
    });

    it('should create note with folder and tags', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      await notesService.createNote({
        title: 'Tagged Note',
        transcript: 'Content',
        folder_id: 'folder-1',
        tags: ['tag1', 'tag2'],
      });

      expect(api.post).toHaveBeenCalledWith('/notes', {
        title: 'Tagged Note',
        transcript: 'Content',
        folder_id: 'folder-1',
        tags: ['tag1', 'tag2'],
      });
    });
  });

  describe('updateNote', () => {
    it('should update note fields', async () => {
      const updatedNote = { id: 'note-1', title: 'Updated' };

      (api.patch as jest.Mock).mockResolvedValueOnce({ data: updatedNote });

      const result = await notesService.updateNote('note-1', { title: 'Updated' });

      expect(result.data).toEqual(updatedNote);
      expect(api.patch).toHaveBeenCalledWith('/notes/note-1', { title: 'Updated' });
    });

    it('should update pinned status', async () => {
      (api.patch as jest.Mock).mockResolvedValueOnce({ data: {} });

      await notesService.updateNote('note-1', { is_pinned: true });

      expect(api.patch).toHaveBeenCalledWith('/notes/note-1', { is_pinned: true });
    });
  });

  describe('deleteNote', () => {
    it('should soft delete note by default', async () => {
      (api.delete as jest.Mock).mockResolvedValueOnce({});

      const result = await notesService.deleteNote('note-1');

      expect(result.success).toBe(true);
      expect(api.delete).toHaveBeenCalledWith('/notes/note-1');
    });

    it('should permanently delete when specified', async () => {
      (api.delete as jest.Mock).mockResolvedValueOnce({});

      await notesService.deleteNote('note-1', true);

      expect(api.delete).toHaveBeenCalledWith('/notes/note-1?permanent=true');
    });

    it('should handle delete errors', async () => {
      (api.delete as jest.Mock).mockResolvedValueOnce({
        error: { status: 403, message: 'Forbidden' },
      });

      const result = await notesService.deleteNote('note-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Forbidden');
    });
  });

  describe('searchNotes', () => {
    it('should search notes with query', async () => {
      const searchResults = { items: [], total: 0 };

      (api.get as jest.Mock).mockResolvedValueOnce({ data: searchResults });

      const result = await notesService.searchNotes('meeting');

      expect(result.data).toEqual(searchResults);
      expect(api.get).toHaveBeenCalledWith('/notes/search?q=meeting&page=1');
    });

    it('should encode special characters in search query', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({ data: {} });

      await notesService.searchNotes('hello world');

      expect(api.get).toHaveBeenCalledWith('/notes/search?q=hello%20world&page=1');
    });
  });

  describe('folder operations', () => {
    it('should list folders', async () => {
      const folders = [{ id: 'f1', name: 'Folder 1' }];

      (api.get as jest.Mock).mockResolvedValueOnce({ data: folders });

      const result = await notesService.listFolders();

      expect(result.data).toEqual(folders);
      expect(api.get).toHaveBeenCalledWith('/folders');
    });

    it('should create folder', async () => {
      const newFolder = { id: 'new-f', name: 'New Folder' };

      (api.post as jest.Mock).mockResolvedValueOnce({ data: newFolder });

      const result = await notesService.createFolder({ name: 'New Folder' });

      expect(result.data).toEqual(newFolder);
    });

    it('should delete folder', async () => {
      (api.delete as jest.Mock).mockResolvedValueOnce({});

      const result = await notesService.deleteFolder('folder-1');

      expect(result.success).toBe(true);
      expect(api.delete).toHaveBeenCalledWith('/folders/folder-1');
    });

    it('should update folder', async () => {
      (api.patch as jest.Mock).mockResolvedValueOnce({ data: {} });

      await notesService.updateFolder('folder-1', { name: 'Renamed' });

      expect(api.patch).toHaveBeenCalledWith('/folders/folder-1', { name: 'Renamed' });
    });

    it('should setup default folders', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({});

      const result = await notesService.setupDefaultFolders();

      expect(result.success).toBe(true);
      expect(api.post).toHaveBeenCalledWith('/folders/setup-defaults');
    });
  });

  describe('convertToNote', () => {
    it('should convert API response to Note format', () => {
      const apiNote: NoteDetailResponse = {
        id: 'note-1',
        title: 'Test Note',
        transcript: 'Test content',
        summary: 'Summary',
        duration: 120,
        audio_url: 'https://example.com/audio.mp3',
        folder_id: 'folder-1',
        folder_name: 'Work',
        tags: ['important', 'meeting'],
        is_pinned: true,
        is_archived: false,
        ai_processed: true,
        actions: [
          {
            id: 'action-1',
            note_id: 'note-1',
            action_type: 'calendar',
            status: 'executed',
            priority: 'high',
            title: 'Team Meeting',
            description: 'Weekly sync',
            scheduled_date: '2024-01-15T10:00:00Z',
            scheduled_end_date: null,
            location: 'Room A',
            attendees: ['john@example.com'],
            email_to: null,
            email_subject: null,
            email_body: null,
            external_id: null,
            external_service: null,
            external_url: null,
            created_at: '2024-01-10T10:00:00Z',
            executed_at: null,
          },
        ],
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-10T10:00:00Z',
      };

      const result = notesService.convertToNote(apiNote);

      expect(result.id).toBe('note-1');
      expect(result.title).toBe('Test Note');
      expect(result.transcript).toBe('Test content');
      expect(result.duration).toBe(120);
      expect(result.folderId).toBe('folder-1');
      expect(result.tags).toEqual(['important', 'meeting']);
      expect(result.actions.calendar).toHaveLength(1);
      expect(result.actions.calendar[0].status).toBe('created');
    });

    it('should handle note without folder', () => {
      const apiNote: NoteDetailResponse = {
        id: 'note-1',
        title: 'Test',
        transcript: '',
        summary: null,
        duration: null,
        audio_url: null,
        folder_id: null,
        folder_name: null,
        tags: [],
        is_pinned: false,
        is_archived: false,
        ai_processed: false,
        actions: [],
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-10T10:00:00Z',
      };

      const result = notesService.convertToNote(apiNote);

      expect(result.folderId).toBe('all-icloud');
      expect(result.duration).toBe(0);
    });
  });

  describe('convertToFolder', () => {
    it('should convert API folder to Folder format', () => {
      const apiFolder: FolderResponse = {
        id: 'folder-1',
        name: 'Work',
        icon: 'briefcase',
        color: '#FF5733',
        is_system: false,
        note_count: 5,
        sort_order: 1,
        parent_id: null,
        depth: 0,
        children: [
          {
            id: 'folder-2',
            name: 'Projects',
            icon: 'folder',
            color: null,
            is_system: false,
            note_count: 3,
            sort_order: 0,
            parent_id: 'folder-1',
            depth: 1,
            children: [],
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = notesService.convertToFolder(apiFolder);

      expect(result.id).toBe('folder-1');
      expect(result.name).toBe('Work');
      expect(result.icon).toBe('briefcase');
      expect(result.color).toBe('#FF5733');
      expect(result.noteCount).toBe(5);
      expect(result.children).toHaveLength(1);
      expect(result.children![0].name).toBe('Projects');
    });

    it('should handle folder without color', () => {
      const apiFolder: FolderResponse = {
        id: 'folder-1',
        name: 'Test',
        icon: 'folder',
        color: null,
        is_system: true,
        note_count: 0,
        sort_order: 0,
        parent_id: null,
        depth: 0,
        children: [],
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = notesService.convertToFolder(apiFolder);

      expect(result.color).toBeUndefined();
      expect(result.isSystem).toBe(true);
    });
  });

  describe('reorderFolders', () => {
    it('should send reorder request', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({});

      const updates = [
        { id: 'folder-1', sort_order: 0, parent_id: null },
        { id: 'folder-2', sort_order: 1, parent_id: null },
      ];

      const result = await notesService.reorderFolders(updates);

      expect(result.success).toBe(true);
      expect(api.post).toHaveBeenCalledWith('/folders/reorder', { folders: updates });
    });
  });
});
