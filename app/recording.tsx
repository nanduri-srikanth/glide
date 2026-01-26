import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, Alert, View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { NotesColors } from '@/constants/theme';
import { RecordingOverlay } from '@/components/notes/RecordingOverlay';
import { FolderSelectionSheet } from '@/components/notes/FolderSelectionSheet';
import { useRecording } from '@/hooks/useRecording';
import { useAuth } from '@/context/AuthContext';
import { useNotes } from '@/context/NotesContext';
import { notesService } from '@/services/notes';
import { voiceService } from '@/services/voice';

export default function RecordingScreen() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams<{ folderId?: string }>();
  const { isAuthenticated } = useAuth();
  const { refreshAll } = useNotes();
  const {
    isRecording,
    isPaused,
    duration,
    isProcessing,
    processingProgress,
    processingStatus,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    processRecording,
    resetState,
  } = useRecording();

  const [showProcessing, setShowProcessing] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [showFolderSheet, setShowFolderSheet] = useState(false);
  const [pendingAudioUri, setPendingAudioUri] = useState<string | null>(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [sheetProcessing, setSheetProcessing] = useState(false);
  const [sheetProcessingStatus, setSheetProcessingStatus] = useState('');

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handlePauseRecording = async () => {
    await pauseRecording();
  };

  const handleResumeRecording = async () => {
    await resumeRecording();
  };

  const handleStopRecording = async (notes?: string) => {
    if (notes) setUserNotes(notes);

    const uri = await stopRecording();

    if (!uri) {
      Alert.alert('Error', 'Failed to save recording');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        'Recording Saved',
        `Your ${formatDuration(duration)} recording has been saved. Sign in to sync and process with AI.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    // If coming from a specific folder, process directly
    if (folderId) {
      setShowProcessing(true);
      const result = await processRecording(folderId, notes || userNotes);
      setShowProcessing(false);

      if (result) {
        await refreshAll();
        Alert.alert(
          'Note Created',
          `Your voice memo has been transcribed and processed. ${result.actions_count} actions were identified.`,
          [
            {
              text: 'View Note',
              onPress: () => {
                resetState();
                router.replace(`/notes/detail/${result.note_id}`);
              },
            },
          ]
        );
      } else if (error) {
        Alert.alert('Processing Failed', error, [
          { text: 'Try Again', onPress: () => setShowProcessing(false) },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ]);
      }
    } else {
      // Show folder selection sheet
      setPendingAudioUri(uri);
      setPendingNotes(notes || userNotes || '');
      setShowFolderSheet(true);
    }
  };

  const handleFolderSelected = async (selectedFolderId: string) => {
    await processNoteWithFolder(selectedFolderId);
  };

  const handleAutoSort = async () => {
    setSheetProcessingStatus('AI is analyzing your note...');
    await processNoteWithFolder(undefined, true);
  };

  const handleCreateFolder = () => {
    Alert.prompt(
      'New Folder',
      'Enter a name for this folder',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create & Save',
          onPress: async (name) => {
            if (name?.trim()) {
              setSheetProcessing(true);
              setSheetProcessingStatus('Creating folder...');

              try {
                const { data: folder, error: folderError } = await notesService.createFolder({
                  name: name.trim(),
                  icon: 'folder',
                });

                if (folderError) {
                  Alert.alert('Error', folderError);
                  setSheetProcessing(false);
                  return;
                }

                if (folder) {
                  // Now save the note to the new folder
                  await processNoteWithFolder(folder.id);
                }
              } catch (err) {
                Alert.alert('Error', 'Failed to create folder.');
                setSheetProcessing(false);
              }
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  const processNoteWithFolder = async (selectedFolderId?: string, autoSort: boolean = false) => {
    setSheetProcessing(true);
    setSheetProcessingStatus(autoSort ? 'AI is sorting your note...' : 'Processing...');

    try {
      if (pendingAudioUri) {
        const { data, error: apiError } = await voiceService.processVoiceMemo(
          pendingAudioUri,
          autoSort ? undefined : selectedFolderId,
          (progress, status) => setSheetProcessingStatus(status),
          pendingNotes
        );

        if (apiError) {
          Alert.alert('Error', apiError);
          setSheetProcessing(false);
          return;
        }

        if (data) {
          await refreshAll();
          setShowFolderSheet(false);
          resetState();
          router.replace(`/notes/detail/${data.note_id}`);
        }
      } else if (pendingNotes.trim()) {
        const firstLine = pendingNotes.split('\n')[0].trim();
        const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;

        const { data, error: apiError } = await notesService.createNote({
          title: title || 'New Note',
          transcript: pendingNotes,
          folder_id: autoSort ? undefined : selectedFolderId,
        });

        if (apiError) {
          Alert.alert('Error', apiError);
          setSheetProcessing(false);
          return;
        }

        if (data) {
          await refreshAll();
          setShowFolderSheet(false);
          resetState();
          router.replace(`/notes/detail/${data.id}`);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to process note.');
      setSheetProcessing(false);
    }
  };

  const handleSubmitTextOnly = async (notes: string) => {
    if (!notes.trim()) {
      Alert.alert('Error', 'Please enter some text for your note.');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to create notes.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    // If coming from a specific folder, process directly
    if (folderId) {
      setShowProcessing(true);

      try {
        const firstLine = notes.split('\n')[0].trim();
        const title = firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;

        const { data, error: apiError } = await notesService.createNote({
          title: title || 'New Note',
          transcript: notes,
          folder_id: folderId,
        });

        setShowProcessing(false);

        if (apiError) {
          Alert.alert('Error', apiError, [
            { text: 'Try Again', onPress: () => {} },
            { text: 'Discard', style: 'destructive', onPress: () => router.back() },
          ]);
          return;
        }

        if (data) {
          await refreshAll();
          Alert.alert(
            'Note Created',
            'Your note has been saved.',
            [
              {
                text: 'View Note',
                onPress: () => {
                  resetState();
                  router.replace(`/notes/detail/${data.id}`);
                },
              },
            ]
          );
        }
      } catch (err) {
        setShowProcessing(false);
        Alert.alert('Error', 'Failed to create note. Please try again.');
      }
    } else {
      // Show folder selection sheet
      setPendingAudioUri(null);
      setPendingNotes(notes);
      setShowFolderSheet(true);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      Alert.alert(
        'Discard Recording?',
        'Are you sure you want to discard this recording?',
        [
          { text: 'Keep Recording', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              await cancelRecording();
              router.back();
            },
          },
        ]
      );
    } else if (showProcessing || isProcessing) {
      Alert.alert(
        'Cancel Processing?',
        'The recording is being processed. Are you sure you want to cancel?',
        [
          { text: 'Continue', style: 'cancel' },
          {
            text: 'Cancel',
            style: 'destructive',
            onPress: () => {
              resetState();
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (showProcessing || isProcessing) {
    const hasAudio = duration > 0;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={NotesColors.primary} />
          <Text style={styles.processingTitle}>
            {hasAudio ? 'Processing Recording' : 'Saving Note'}
          </Text>
          <Text style={styles.processingStatus}>
            {processingStatus || (hasAudio ? 'Uploading audio...' : 'Creating note...')}
          </Text>
          {processingProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${processingProgress}%` }]} />
            </View>
          )}
          <Text style={styles.processingHint}>
            {hasAudio
              ? 'This may take a moment while we transcribe and analyze your voice memo.'
              : 'Saving your note...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <RecordingOverlay
        isRecording={isRecording}
        isPaused={isPaused}
        duration={duration}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onPauseRecording={handlePauseRecording}
        onResumeRecording={handleResumeRecording}
        onCancel={handleCancel}
        onSubmitTextOnly={handleSubmitTextOnly}
      />
      <FolderSelectionSheet
        visible={showFolderSheet}
        onSelectFolder={handleFolderSelected}
        onAutoSort={handleAutoSort}
        onCreateFolder={handleCreateFolder}
        onClose={() => setShowFolderSheet(false)}
        isProcessing={sheetProcessing}
        processingStatus={sheetProcessingStatus}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NotesColors.background,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  processingTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  processingStatus: {
    fontSize: 16,
    color: NotesColors.primary,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: NotesColors.card,
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: NotesColors.primary,
    borderRadius: 2,
  },
  processingHint: {
    fontSize: 14,
    color: NotesColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
