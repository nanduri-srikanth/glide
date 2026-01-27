import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import { getNoteById, formatDuration } from '@/data/mockNotes';
import { AISummaryPanel } from '@/components/notes/AISummaryPanel';
import { useNoteDetail } from '@/hooks/useNoteDetail';
import { useAuth } from '@/context/AuthContext';
import { Note } from '@/data/types';

export default function NoteDetailScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { note: apiNote, rawNote, isLoading, error, deleteNote, executeAction, completeAction } = useNoteDetail(noteId);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use API note if available, otherwise fall back to mock data
  const note: Note | null = apiNote || getNoteById(noteId || '');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NotesColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Note Not Found' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Note not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleViewDraft = async (emailId: string) => {
    // Execute the email action to open draft in Gmail/Apple Mail
    const result = await executeAction(emailId, 'google');
    if (result?.redirect_url) {
      // In a real app, open the URL in browser
      console.log('Open draft:', result.redirect_url);
    }
  };

  const handleExecuteAction = async (actionId: string, service: 'google' | 'apple') => {
    const result = await executeAction(actionId, service);
    if (result) {
      Alert.alert('Success', result.message || 'Action executed successfully');
    }
  };

  const handleCompleteAction = async (actionId: string) => {
    const success = await completeAction(actionId);
    if (success) {
      Alert.alert('Success', 'Action marked as complete');
    }
  };

  const handleShare = () => {
    // In a real app, this would open share sheet
    console.log('Share note');
  };

  const handleEdit = () => {
    // In a real app, this would open edit mode
    console.log('Edit note');
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const success = await deleteNote();
            setIsDeleting(false);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete note');
            }
          },
        },
      ]
    );
  };

  // Convert rawNote actions to the format expected by AISummaryPanel
  const extractTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const actions = rawNote?.actions ? {
    calendar: rawNote.actions
      .filter(a => a.action_type === 'calendar')
      .map(a => ({
        id: a.id,
        title: a.title,
        date: a.scheduled_date || '',
        time: extractTime(a.scheduled_date),
        status: a.status,
      })),
    email: rawNote.actions
      .filter(a => a.action_type === 'email')
      .map(a => ({
        id: a.id,
        to: a.email_to || '',
        subject: a.email_subject || a.title,
        preview: a.email_body?.slice(0, 100) || '',
        status: (a.status === 'executed' ? 'sent' : 'draft') as 'draft' | 'sent',
      })),
    reminders: rawNote.actions
      .filter(a => a.action_type === 'reminder')
      .map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.scheduled_date || '',
        dueTime: extractTime(a.scheduled_date),
        priority: a.priority,
        status: a.status,
      })),
    nextSteps: rawNote.actions
      .filter(a => a.action_type === 'next_step')
      .map(a => a.title),
  } : note.actions;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: false,
          headerStyle: { backgroundColor: NotesColors.background },
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color={NotesColors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{note.title}</Text>
          <View style={styles.metadata}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={NotesColors.textSecondary} />
              <Text style={styles.metaText}>{formatFullDate(note.timestamp)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="mic-outline" size={14} color={NotesColors.textSecondary} />
              <Text style={styles.metaText}>{formatDuration(note.duration)} recording</Text>
            </View>
          </View>

          {/* Tags */}
          {note.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {note.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* AI Summary Panel - CRITICAL COMPONENT */}
        <AISummaryPanel
          actions={actions}
          onViewDraft={handleViewDraft}
          onExecuteAction={isAuthenticated ? handleExecuteAction : undefined}
          onCompleteAction={isAuthenticated ? handleCompleteAction : undefined}
        />

        {/* Transcript Section */}
        <View style={styles.transcriptSection}>
          <View style={styles.transcriptHeader}>
            <Ionicons name="document-text-outline" size={20} color={NotesColors.primary} />
            <Text style={styles.transcriptTitle}>Full Transcript</Text>
          </View>
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptText}>{note.transcript}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={24} color={NotesColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Ionicons name="checkmark-circle-outline" size={24} color={NotesColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Ionicons name="camera-outline" size={24} color={NotesColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Ionicons name="pencil-outline" size={24} color={NotesColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={NotesColors.textSecondary} />
          ) : (
            <Ionicons name="trash-outline" size={24} color={NotesColors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NotesColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 17,
    color: NotesColors.textSecondary,
  },
  headerButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: NotesColors.textPrimary,
    marginBottom: 12,
  },
  metadata: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: NotesColors.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    backgroundColor: 'rgba(98, 69, 135, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 13,
    color: NotesColors.primary,
    fontWeight: '500',
  },
  transcriptSection: {
    marginTop: 8,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  transcriptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: NotesColors.textPrimary,
  },
  transcriptCard: {
    backgroundColor: NotesColors.card,
    borderRadius: 12,
    padding: 16,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 26,
    color: NotesColors.textPrimary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: NotesColors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  toolbarButton: {
    padding: 12,
  },
});
