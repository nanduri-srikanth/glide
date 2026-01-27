import React, { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import { mockFolders } from '@/data/mockFolders';
import { getNotesByFolder } from '@/data/mockNotes';
import { SwipeableNoteCard } from '@/components/notes/SwipeableNoteCard';
import { SearchBar } from '@/components/notes/SearchBar';
import { ComposeButton } from '@/components/notes/ComposeButton';
import { MoveFolderSheet } from '@/components/notes/MoveFolderSheet';
import { Note } from '@/data/types';
import { useNotes } from '@/context/NotesContext';
import { useAuth } from '@/context/AuthContext';

interface Section {
  title: string;
  data: Note[];
}

export default function NoteListScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { notes: apiNotes, folders, isLoading, error, fetchNotes, searchNotes, deleteNote, moveNote } = useNotes();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [noteToMove, setNoteToMove] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const apiFolder = folders.find((f) => f.id === folderId);
  const mockFolder = mockFolders.find((f) => f.id === folderId);
  const folder = apiFolder || mockFolder;
  const isAllNotesFolder = folder?.name === 'All Notes';
  const isRealFolder = !!apiFolder; // Only true if folder exists in API response

  // Refresh notes when screen gains focus (after creating a new note, etc.)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && folderId) {
        // For "All Notes" folder, fetch all notes without folder filter
        if (isAllNotesFolder) {
          fetchNotes(undefined);
        } else if (isRealFolder) {
          // Only fetch with folder filter if it's a real API folder (valid UUID)
          fetchNotes(folderId);
        } else {
          // Mock folder - fetch all notes since we can't filter by mock ID
          fetchNotes(undefined);
        }
      }
    }, [isAuthenticated, folderId, isAllNotesFolder, isRealFolder, fetchNotes])
  );

  // Use API notes - only fall back to mock data if not authenticated
  const notes: Note[] = useMemo(() => {
    if (isAuthenticated) {
      // When authenticated, always use API notes (even if empty)
      return apiNotes.map(n => ({
        id: n.id,
        title: n.title,
        timestamp: n.created_at,
        transcript: n.preview || '',
        duration: n.duration || 0,
        actions: {
          calendar: n.calendar_count > 0 ? [{ id: '1', title: 'Event', date: '', time: '' }] : [],
          email: n.email_count > 0 ? [{ id: '1', to: '', subject: '', status: 'draft' as const }] : [],
          reminders: n.reminder_count > 0 ? [{ id: '1', title: 'Reminder', dueDate: '' }] : [],
          nextSteps: [],
        },
        folderId: n.folder_id || folderId || '',
        tags: n.tags || [],
      }));
    }
    // Only use mock data when not authenticated
    return getNotesByFolder(folderId || '');
  }, [apiNotes, folderId, isAuthenticated]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.transcript.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  const sections = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayNotes: Note[] = [];
    const weekNotes: Note[] = [];
    const olderNotes: Note[] = [];

    filteredNotes.forEach((note) => {
      const noteDate = new Date(note.timestamp);
      if (noteDate >= today) {
        todayNotes.push(note);
      } else if (noteDate >= weekAgo) {
        weekNotes.push(note);
      } else {
        olderNotes.push(note);
      }
    });

    const result: Section[] = [];
    if (todayNotes.length > 0) {
      result.push({ title: 'Today', data: todayNotes });
    }
    if (weekNotes.length > 0) {
      result.push({ title: 'Previous 7 Days', data: weekNotes });
    }
    if (olderNotes.length > 0) {
      result.push({ title: 'Earlier', data: olderNotes });
    }

    return result;
  }, [filteredNotes]);

  const handleNotePress = (note: Note) => {
    router.push(`/notes/detail/${note.id}`);
  };

  const handleComposePress = () => {
    router.push({ pathname: '/recording', params: { folderId } });
  };

  const handleMicPress = () => {
    router.push({ pathname: '/recording', params: { folderId } });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isAuthenticated && folderId) {
      if (isAllNotesFolder) {
        await fetchNotes(undefined);
      } else {
        await fetchNotes(folderId);
      }
    }
    setRefreshing(false);
  }, [isAuthenticated, folderId, isAllNotesFolder, fetchNotes]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (isAuthenticated && query.trim()) {
      await searchNotes(query);
    }
  }, [isAuthenticated, searchNotes]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const success = await deleteNote(noteId);
    if (success) {
      // Refresh the list
      if (isAuthenticated && folderId) {
        await fetchNotes(isAllNotesFolder ? undefined : folderId);
      }
    } else {
      Alert.alert('Error', 'Failed to delete note. Please try again.');
    }
  }, [deleteNote, isAuthenticated, folderId, isAllNotesFolder, fetchNotes]);

  const handleMoveNote = useCallback((noteId: string) => {
    setNoteToMove(noteId);
    setShowMoveSheet(true);
  }, []);

  const handleSelectMoveFolder = useCallback(async (targetFolderId: string) => {
    if (!noteToMove) return;

    setIsMoving(true);
    const success = await moveNote(noteToMove, targetFolderId);
    setIsMoving(false);

    if (success) {
      setShowMoveSheet(false);
      setNoteToMove(null);
      // Refresh the current list
      if (isAuthenticated && folderId) {
        await fetchNotes(isAllNotesFolder ? undefined : folderId);
      }
    } else {
      Alert.alert('Error', 'Failed to move note. Please try again.');
    }
  }, [noteToMove, moveNote, isAuthenticated, folderId, isAllNotesFolder, fetchNotes]);

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNotes.size === 0) return;

    Alert.alert(
      'Delete Notes',
      `Are you sure you want to delete ${selectedNotes.size} note${selectedNotes.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const noteId of selectedNotes) {
              await deleteNote(noteId);
            }
            setSelectedNotes(new Set());
            setIsEditMode(false);
            if (isAuthenticated && folderId) {
              await fetchNotes(isAllNotesFolder ? undefined : folderId);
            }
          },
        },
      ]
    );
  }, [selectedNotes, deleteNote, isAuthenticated, folderId, fetchNotes]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
    setSelectedNotes(new Set());
  }, []);

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderNote = ({ item }: { item: Note }) => (
    <SwipeableNoteCard
      note={item}
      onPress={() => handleNotePress(item)}
      onDelete={handleDeleteNote}
      onMove={handleMoveNote}
      isEditMode={isEditMode}
      isSelected={selectedNotes.has(item.id)}
      onSelect={handleSelectNote}
    />
  );

  const headerRight = () => (
    <View style={styles.headerButtons}>
      {isEditMode ? (
        <>
          {selectedNotes.size > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleDeleteSelected}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton} onPress={toggleEditMode}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.headerButton} onPress={toggleEditMode}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: folder?.name || 'Notes',
            headerRight,
          }}
        />

        <SectionList
          sections={sections}
          renderItem={renderNote}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={NotesColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {isLoading ? (
                <ActivityIndicator size="large" color={NotesColors.primary} />
              ) : (
                <Text style={styles.emptyText}>{typeof error === 'string' ? error : 'No notes found'}</Text>
              )}
            </View>
          }
        />

        {isEditMode && selectedNotes.size > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionText}>
              {selectedNotes.size} selected
            </Text>
            <TouchableOpacity onPress={() => setSelectedNotes(new Set())}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isEditMode && (
          <>
            <SearchBar
              value={searchQuery}
              onChangeText={handleSearch}
              onMicPress={handleMicPress}
              placeholder="Search notes"
            />
            <ComposeButton onPress={handleComposePress} />
          </>
        )}

        <MoveFolderSheet
          visible={showMoveSheet}
          currentFolderId={folderId}
          onSelectFolder={handleSelectMoveFolder}
          onClose={() => {
            setShowMoveSheet(false);
            setNoteToMove(null);
          }}
          isProcessing={isMoving}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NotesColors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 8,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: NotesColors.background,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: NotesColors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    color: NotesColors.textSecondary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 4,
  },
  editText: {
    fontSize: 17,
    color: NotesColors.primary,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: NotesColors.primary,
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NotesColors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NotesColors.textSecondary,
  },
  selectionText: {
    fontSize: 16,
    color: NotesColors.textPrimary,
    fontWeight: '500',
  },
  clearText: {
    fontSize: 16,
    color: NotesColors.primary,
  },
});
