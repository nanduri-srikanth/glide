import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import { getNoteById, formatDuration } from '@/data/mockNotes';
import { AISummaryPanel } from '@/components/notes/AISummaryPanel';
import { useNoteDetail } from '@/hooks/useNoteDetail';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/context/AuthContext';
import { Note } from '@/data/types';

export default function NoteDetailScreen() {
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    note: apiNote,
    rawNote,
    isLoading,
    error,
    deleteNote,
    updateNote,
    executeAction,
    completeAction,
    appendAudio,
    isAppending,
    appendProgress,
    appendStatus,
  } = useNoteDetail(noteId);
  const {
    isRecording,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError,
  } = useRecording();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const transcriptInputRef = useRef<TextInput>(null);

  // Use API note if available, otherwise fall back to mock data
  const note: Note | null = apiNote || getNoteById(noteId || '') || null;

  // Initialize edit fields when note loads or changes
  useEffect(() => {
    if (note && !isEditing) {
      setEditedTitle(note.title);
      setEditedTranscript(note.transcript);
    }
  }, [note?.title, note?.transcript, isEditing]);

  // Debounced auto-save function
  const debouncedSave = useCallback(async (title: string, transcript: string) => {
    if (!isAuthenticated || !note) return;

    setIsSaving(true);
    const success = await updateNote({ title, transcript });
    setIsSaving(false);

    if (success) {
      setHasUnsavedChanges(false);
    } else {
      Alert.alert('Save Failed', 'Unable to save changes. Please try again.');
    }
  }, [isAuthenticated, note, updateNote]);

  // Handle text changes with debounce
  const handleTitleChange = useCallback((text: string) => {
    setEditedTitle(text);
    setHasUnsavedChanges(true);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(text, editedTranscript);
    }, 1500);
  }, [editedTranscript, debouncedSave]);

  const handleTranscriptChange = useCallback((text: string) => {
    setEditedTranscript(text);
    setHasUnsavedChanges(true);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(editedTitle, text);
    }, 1500);
  }, [editedTitle, debouncedSave]);

  // Enter edit mode
  const handleEdit = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to edit notes.');
      return;
    }
    setIsEditing(true);
    // Focus title input after a brief delay
    setTimeout(() => titleInputRef.current?.focus(), 100);
  }, [isAuthenticated]);

  // Exit edit mode (can be called manually or on blur)
  const handleDoneEditing = useCallback(async () => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save if there are unsaved changes
    if (hasUnsavedChanges) {
      setIsSaving(true);
      await updateNote({ title: editedTitle, transcript: editedTranscript });
      setIsSaving(false);
      setHasUnsavedChanges(false);
    }

    Keyboard.dismiss();
    setIsEditing(false);
  }, [hasUnsavedChanges, editedTitle, editedTranscript, updateNote]);

  // Track if either input is focused
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isTranscriptFocused, setIsTranscriptFocused] = useState(false);

  // Handle blur - exit edit mode if neither field is focused
  const handleTitleBlur = useCallback(() => {
    setIsTitleFocused(false);
    // Small delay to allow focus to transfer to transcript field
    setTimeout(() => {
      if (!isTranscriptFocused) {
        handleDoneEditing();
      }
    }, 100);
  }, [isTranscriptFocused, handleDoneEditing]);

  const handleTranscriptBlur = useCallback(() => {
    setIsTranscriptFocused(false);
    // Small delay to allow focus to transfer to title field
    setTimeout(() => {
      if (!isTitleFocused) {
        handleDoneEditing();
      }
    }, 100);
  }, [isTitleFocused, handleDoneEditing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Format recording duration as MM:SS
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mic button press
  const handleMicPress = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to add audio.');
      return;
    }
    setShowRecordingModal(true);
    startRecording();
  }, [isAuthenticated, startRecording]);

  // Handle stop recording and append
  const handleStopAndAppend = useCallback(async () => {
    const uri = await stopRecording();
    if (uri) {
      const success = await appendAudio(uri);
      if (success) {
        Alert.alert('Success', 'Audio has been added to your note.');
      } else {
        Alert.alert('Error', 'Failed to add audio. Please try again.');
      }
    }
    setShowRecordingModal(false);
  }, [stopRecording, appendAudio]);

  // Handle cancel recording
  const handleCancelRecording = useCallback(async () => {
    await cancelRecording();
    setShowRecordingModal(false);
  }, [cancelRecording]);

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
            isEditing ? (
              <TouchableOpacity onPress={handleDoneEditing} style={styles.headerButton}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                <Ionicons name="share-outline" size={24} color={NotesColors.primary} />
              </TouchableOpacity>
            )
          ),
        }}
      />

      {/* Saving Indicator */}
      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={NotesColors.primary} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {isEditing ? (
            <TextInput
              ref={titleInputRef}
              style={styles.titleInput}
              value={editedTitle}
              onChangeText={handleTitleChange}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={handleTitleBlur}
              placeholder="Note title"
              placeholderTextColor={NotesColors.textSecondary}
              multiline
              blurOnSubmit
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
              <Text style={styles.title}>{note.title}</Text>
            </TouchableOpacity>
          )}
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
            {isEditing ? (
              <TextInput
                ref={transcriptInputRef}
                style={styles.transcriptInput}
                value={editedTranscript}
                onChangeText={handleTranscriptChange}
                onFocus={() => setIsTranscriptFocused(true)}
                onBlur={handleTranscriptBlur}
                placeholder="Transcript content"
                placeholderTextColor={NotesColors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
                <Text style={styles.transcriptText}>{note.transcript}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={24} color={NotesColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={handleMicPress}
          disabled={isAppending}
        >
          {isAppending ? (
            <ActivityIndicator size="small" color={NotesColors.primary} />
          ) : (
            <Ionicons name="mic-outline" size={24} color={NotesColors.primary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Ionicons name="camera-outline" size={24} color={NotesColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton}>
          <Ionicons name="share-outline" size={24} color={NotesColors.textSecondary} />
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

      {/* Recording Modal */}
      <Modal
        visible={showRecordingModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelRecording}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.recordingModal}>
            <Text style={styles.recordingModalTitle}>Add to Note</Text>

            {isAppending ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={NotesColors.primary} />
                <Text style={styles.processingText}>{appendStatus || 'Processing...'}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${appendProgress}%` }]} />
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>

                {/* Simple waveform visualization */}
                <View style={styles.waveformContainer}>
                  {[...Array(15)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.waveformBar,
                        {
                          height: isRecording
                            ? 10 + Math.random() * 30
                            : 10,
                        },
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.recordingButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelRecording}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={handleStopAndAppend}
                  >
                    <View style={styles.stopButtonInner} />
                    <Text style={styles.stopButtonText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {recordingError && (
              <Text style={styles.recordingErrorText}>{recordingError}</Text>
            )}
          </View>
        </View>
      </Modal>
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
  doneButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: NotesColors.primary,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(98, 69, 135, 0.1)',
  },
  savingText: {
    fontSize: 14,
    color: NotesColors.textSecondary,
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
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    color: NotesColors.textPrimary,
    marginBottom: 12,
    padding: 0,
    minHeight: 40,
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
  transcriptInput: {
    fontSize: 16,
    lineHeight: 26,
    color: NotesColors.textPrimary,
    padding: 0,
    minHeight: 200,
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
  // Recording Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  recordingModal: {
    width: '100%',
    backgroundColor: NotesColors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  recordingModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginBottom: 24,
  },
  recordingTime: {
    fontSize: 48,
    fontWeight: '200',
    color: NotesColors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 4,
    marginBottom: 32,
  },
  waveformBar: {
    width: 4,
    backgroundColor: NotesColors.primary,
    borderRadius: 2,
  },
  recordingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 17,
    color: NotesColors.textSecondary,
  },
  stopButton: {
    alignItems: 'center',
    gap: 8,
  },
  stopButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonText: {
    fontSize: 14,
    color: NotesColors.textSecondary,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  processingText: {
    fontSize: 16,
    color: NotesColors.textSecondary,
    marginTop: 16,
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: NotesColors.primary,
  },
  recordingErrorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 16,
  },
});
