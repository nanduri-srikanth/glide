// TypeScript interfaces for the Notes app

export interface CalendarAction {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  attendees?: string[];
  status: 'created' | 'pending' | 'confirmed';
}

export interface EmailAction {
  id: string;
  to: string;
  subject: string;
  preview: string;
  status: 'draft' | 'sent' | 'scheduled';
  scheduledTime?: string;
}

export interface ReminderAction {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

export interface NoteActions {
  calendar: CalendarAction[];
  email: EmailAction[];
  reminders: ReminderAction[];
  nextSteps: string[];
}

export interface Note {
  id: string;
  title: string;
  timestamp: string;
  transcript: string;
  duration: number; // in seconds
  actions: NoteActions;
  folderId: string;
  tags: string[];
}

export interface Folder {
  id: string;
  name: string;
  icon: string; // SF Symbol name
  noteCount: number;
  color?: string;
  isSystem?: boolean; // For "All iCloud", "Notes", "Recently Deleted"
}

export interface NotesState {
  notes: Note[];
  folders: Folder[];
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  isRecording: boolean;
  searchQuery: string;
}

export type ActionType = 'calendar' | 'email' | 'reminder';

export interface ActionBadgeData {
  type: ActionType;
  count: number;
}
