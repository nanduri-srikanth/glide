import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { FloatingActionBar, ActionCounts } from '@/components/notes/FloatingActionBar';
import { EditableActionsPanel } from '@/components/notes/EditableActionsPanel';
import {
  CalendarAction,
  EmailAction,
  ReminderAction,
  NextStepAction,
  EditableAction,
  NoteActions,
} from '@/data/types';
import { useNoteDetail } from '@/hooks/useNoteDetail';
import { useRecording } from '@/hooks/useRecording';
import { useActionDrafts } from '@/hooks/useActionDrafts';
import { useAuth } from '@/context/AuthContext';
import { Note } from '@/data/types';
import { useNavigation } from '@react-navigation/native';
import { generateTitleFromContent, isUserSetTitle } from '@/utils/textUtils';

// Convert mock note actions to server action format for the useActionDrafts hook
function convertMockActionsToServerFormat(actions: NoteActions | undefined) {
  if (!actions) return undefined;

  const serverActions: Array<{
    id: string;
    action_type: string;
    title: string;
    status: string;
    scheduled_date?: string | null;
    location?: string | null;
    attendees?: string[] | null;
    email_to?: string | null;
    email_subject?: string | null;
    email_body?: string | null;
    priority?: string | null;
  }> = [];

  // Convert calendar actions
  actions.calendar.forEach(cal => {
    serverActions.push({
      id: cal.id,
      action_type: 'calendar',
      title: cal.title,
      status: cal.status === 'confirmed' ? 'executed' : 'pending',
      scheduled_date: cal.date && cal.time ? `${cal.date}T${cal.time}:00` : cal.date || null,
      location: cal.location || null,
      attendees: cal.attendees || null,
    });
  });

  // Convert email actions
  actions.email.forEach(email => {
    serverActions.push({
      id: email.id,
      action_type: 'email',
      title: email.subject,
      status: email.status === 'sent' ? 'executed' : 'pending',
      email_to: email.to || null,
      email_subject: email.subject || null,
      email_body: email.body || email.preview || null,
    });
  });

  // Convert reminder actions
  actions.reminders.forEach(rem => {
    serverActions.push({
      id: rem.id,
      action_type: 'reminder',
      title: rem.title,
      status: rem.status === 'completed' ? 'executed' : 'pending',
      scheduled_date: rem.dueDate && rem.dueTime ? `${rem.dueDate}T${rem.dueTime}:00` : rem.dueDate || null,
      priority: rem.priority || null,
    });
  });

  // Convert next steps (strings to objects)
  actions.nextSteps.forEach((step, index) => {
    serverActions.push({
      id: `nextstep-${index}`,
      action_type: 'next_step',
      title: typeof step === 'string' ? step : (step as any).title,
      status: 'pending',
    });
  });

  return serverActions;
}

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

  const navigation = useNavigation();

  // Get mock note for fallback
  const mockNote = getNoteById(noteId || '');

  // Use API note if available, otherwise fall back to mock data
  const note: Note | null = apiNote || mockNote || null;

  // Convert mock actions to server format for the hook when API isn't available
  const serverActionsForHook = useMemo(() => {
    if (rawNote?.actions) {
      return rawNote.actions;
    }
    // Fall back to mock note actions converted to server format
    return convertMockActionsToServerFormat(mockNote?.actions);
  }, [rawNote?.actions, mockNote?.actions]);

  // Use the action drafts hook for dirty tracking and persistence
  const {
    calendarActions: editableCalendarActions,
    emailActions: editableEmailActions,
    reminderActions: editableReminderActions,
    nextStepActions: editableNextStepActions,
    hasUnsavedChanges: hasUnsavedActionChanges,
    hasDraftToRecover,
    draftTimestamp,
    isInitialized: actionsInitialized,
    updateAction: handleUpdateAction,
    deleteAction: handleDeleteAction,
    addAction: handleAddAction,
    recoverDraft,
    discardDraft,
    saveToServer: saveActionsToServer,
    discardChanges: discardActionChanges,
  } = useActionDrafts({
    noteId,
    serverActions: serverActionsForHook,
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isActionsExpanded, setIsActionsExpanded] = useState(true); // Start expanded on first view
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showDraftRecoveryModal, setShowDraftRecoveryModal] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<TextInput>(null);
  const transcriptInputRef = useRef<TextInput>(null);

  // Title auto-generation tracking
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const originalTitleRef = useRef<string>(''); // For reverting if user clears title

  // Initialize edit fields when note loads or changes
  useEffect(() => {
    if (note && !isEditing) {
      setEditedTitle(note.title);
      setEditedTranscript(note.transcript);
      originalTitleRef.current = note.title;
      // Check if the existing title appears to be user-set
      setUserEditedTitle(isUserSetTitle(note.title));
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

    // Mark as user-edited if they typed something meaningful
    if (text.trim().length > 0) {
      setUserEditedTitle(true);
      originalTitleRef.current = text; // Update the "original" to the new user-set title
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // If user cleared the title, revert to original or auto-generate
    let titleToSave = text;
    if (text.trim().length === 0 && editedTranscript.trim().length > 0) {
      // Auto-generate from transcript
      const generatedTitle = generateTitleFromContent(editedTranscript);
      if (generatedTitle) {
        setEditedTitle(generatedTitle);
        titleToSave = generatedTitle;
        setUserEditedTitle(false); // Reset since it's now auto-generated
      }
    }

    // Set new timeout for auto-save (1.5 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(titleToSave, editedTranscript);
    }, 1500);
  }, [editedTranscript, debouncedSave]);

  const handleTranscriptChange = useCallback((text: string) => {
    setEditedTranscript(text);
    setHasUnsavedChanges(true);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-generate title if user hasn't manually set one
    let titleToSave = editedTitle;
    if (!userEditedTitle && text.trim().length > 0) {
      const generatedTitle = generateTitleFromContent(text);
      if (generatedTitle && generatedTitle !== editedTitle) {
        setEditedTitle(generatedTitle);
        titleToSave = generatedTitle;
      }
    }

    // Set new timeout for auto-save (1.5 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(titleToSave, text);
    }, 1500);
  }, [editedTitle, userEditedTitle, debouncedSave]);

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

  // Show draft recovery modal when there's a draft to recover
  useEffect(() => {
    if (hasDraftToRecover && actionsInitialized) {
      setShowDraftRecoveryModal(true);
    }
  }, [hasDraftToRecover, actionsInitialized]);

  // Navigation guard for unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only block if there are unsaved action changes
      if (!hasUnsavedActionChanges) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Store the navigation action to execute if user confirms
      setPendingNavigationAction(() => () => navigation.dispatch(e.data.action));
      setShowExitConfirmModal(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedActionChanges]);

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

  // Handle exit confirmation modal actions
  const handleConfirmExit = useCallback(() => {
    setShowExitConfirmModal(false);
    discardActionChanges();
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    }
  }, [discardActionChanges, pendingNavigationAction]);

  const handleSaveAndExit = useCallback(async () => {
    const success = await saveActionsToServer();
    if (success) {
      setShowExitConfirmModal(false);
      if (pendingNavigationAction) {
        pendingNavigationAction();
        setPendingNavigationAction(null);
      }
    } else {
      Alert.alert('Save Failed', 'Unable to save changes. Please try again.');
    }
  }, [saveActionsToServer, pendingNavigationAction]);

  const handleCancelExit = useCallback(() => {
    setShowExitConfirmModal(false);
    setPendingNavigationAction(null);
  }, []);

  // Handle draft recovery modal actions
  const handleRecoverDraft = useCallback(() => {
    recoverDraft();
    setShowDraftRecoveryModal(false);
  }, [recoverDraft]);

  const handleDiscardDraft = useCallback(async () => {
    await discardDraft();
    setShowDraftRecoveryModal(false);
  }, [discardDraft]);

  // Format draft timestamp for display
  const formatDraftTime = useCallback((timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

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

  const handleExecuteAction = async (actionId: string, service: 'google' | 'apple') => {
    const result = await executeAction(actionId, service);
    if (result) {
      Alert.alert('Success', result.message || 'Action executed successfully');
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

  // Calculate action counts for the floating bar (excluding deleted)
  const actionCounts: ActionCounts = {
    calendar: editableCalendarActions.filter(a => !a.isDeleted).length,
    email: editableEmailActions.filter(a => !a.isDeleted).length,
    reminders: editableReminderActions.filter(a => !a.isDeleted).length,
    nextSteps: editableNextStepActions.filter(a => !a.isDeleted).length,
  };

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

      {/* Unsaved Actions Indicator */}
      {hasUnsavedActionChanges && !isSaving && (
        <View style={styles.unsavedIndicator}>
          <Ionicons name="ellipse" size={8} color={NotesColors.primary} />
          <Text style={styles.unsavedText}>Unsaved changes</Text>
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

        {/* Floating Action Bar - Collapsible actions panel */}
        <FloatingActionBar
          counts={actionCounts}
          isExpanded={isActionsExpanded}
          onToggleExpand={() => setIsActionsExpanded(!isActionsExpanded)}
        >
          <EditableActionsPanel
            calendarActions={editableCalendarActions}
            emailActions={editableEmailActions}
            reminderActions={editableReminderActions}
            nextStepActions={editableNextStepActions}
            onUpdateAction={handleUpdateAction}
            onDeleteAction={handleDeleteAction}
            onAddAction={handleAddAction}
            onExecuteAction={isAuthenticated ? handleExecuteAction : undefined}
          />
        </FloatingActionBar>

        {/* Transcript - flows naturally below tags/actions */}
        {isEditing ? (
          <TextInput
            ref={transcriptInputRef}
            style={styles.transcriptText}
            value={editedTranscript}
            onChangeText={handleTranscriptChange}
            onFocus={() => setIsTranscriptFocused(true)}
            onBlur={handleTranscriptBlur}
            placeholder="Start typing..."
            placeholderTextColor={NotesColors.textSecondary}
            multiline
            textAlignVertical="top"
          />
        ) : (
          <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
            <Text style={styles.transcriptText}>{note.transcript}</Text>
          </TouchableOpacity>
        )}
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

      {/* Exit Confirmation Modal */}
      <Modal
        visible={showExitConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmModalTitle}>Unsaved Changes</Text>
            <Text style={styles.confirmModalText}>
              You have unsaved changes to your actions. What would you like to do?
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.discardButton]}
                onPress={handleConfirmExit}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.saveButton]}
                onPress={handleSaveAndExit}
              >
                <Text style={styles.saveButtonText}>Save & Exit</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.cancelExitButton}
              onPress={handleCancelExit}
            >
              <Text style={styles.cancelExitButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Draft Recovery Modal */}
      <Modal
        visible={showDraftRecoveryModal}
        transparent
        animationType="fade"
        onRequestClose={handleDiscardDraft}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Ionicons name="document-text-outline" size={40} color={NotesColors.primary} style={styles.recoveryIcon} />
            <Text style={styles.confirmModalTitle}>Recover Draft?</Text>
            <Text style={styles.confirmModalText}>
              You have unsaved changes from {formatDraftTime(draftTimestamp)}. Would you like to recover them?
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.discardButton]}
                onPress={handleDiscardDraft}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.saveButton]}
                onPress={handleRecoverDraft}
              >
                <Text style={styles.saveButtonText}>Recover</Text>
              </TouchableOpacity>
            </View>
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
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(98, 69, 135, 0.08)',
  },
  unsavedText: {
    fontSize: 12,
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
  transcriptText: {
    fontSize: 16,
    lineHeight: 26,
    color: NotesColors.textPrimary,
    marginTop: 8,
    minHeight: 100,
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
  // Exit Confirmation and Draft Recovery Modal styles
  confirmModal: {
    width: '100%',
    backgroundColor: NotesColors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginBottom: 12,
  },
  confirmModalText: {
    fontSize: 15,
    color: NotesColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  discardButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  discardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  saveButton: {
    backgroundColor: NotesColors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelExitButton: {
    marginTop: 16,
    paddingVertical: 10,
  },
  cancelExitButtonText: {
    fontSize: 16,
    color: NotesColors.textSecondary,
  },
  recoveryIcon: {
    marginBottom: 12,
  },
});
