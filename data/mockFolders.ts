import { Folder } from './types';

export const mockFolders: Folder[] = [
  {
    id: 'all-icloud',
    name: 'All iCloud',
    icon: 'folder.fill',
    noteCount: 24,
    isSystem: true,
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: 'folder.fill',
    noteCount: 18,
    isSystem: true,
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'folder.fill',
    noteCount: 8,
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: 'folder.fill',
    noteCount: 6,
  },
  {
    id: 'ideas',
    name: 'Ideas',
    icon: 'lightbulb.fill',
    noteCount: 4,
  },
  {
    id: 'meetings',
    name: 'Meeting Notes',
    icon: 'person.2.fill',
    noteCount: 12,
  },
  {
    id: 'recently-deleted',
    name: 'Recently Deleted',
    icon: 'trash.fill',
    noteCount: 2,
    isSystem: true,
  },
];
