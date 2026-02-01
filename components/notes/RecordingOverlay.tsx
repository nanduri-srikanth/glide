import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';

// Destination type for context indicator
export interface RecordingDestination {
  type: 'note' | 'folder' | 'quick';
  name: string;
  id?: string;
}

interface RecordingOverlayProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordingUri?: string | null;
  destination?: RecordingDestination | null;
  onStartRecording: () => void;
  onStopRecording: () => Promise<string | null>;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onCancel: () => void;
  onProcess: (notes: string, audioUri?: string | null) => void;
  onAddToNote?: (notes: string, audioUri?: string | null) => void;
  onIntoFolder?: (notes: string, audioUri?: string | null) => void;
}

// Animated wave bar component
function WaveBar({ delay, isActive }: { delay: number; isActive: boolean }) {
  const height = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (isActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(height, {
            toValue: 20 + Math.random() * 12,
            duration: 150 + Math.random() * 100,
            useNativeDriver: false,
          }),
          Animated.timing(height, {
            toValue: 6 + Math.random() * 4,
            duration: 150 + Math.random() * 100,
            useNativeDriver: false,
          }),
        ])
      );

      const timeout = setTimeout(() => animation.start(), delay);
      return () => {
        clearTimeout(timeout);
        animation.stop();
      };
    } else {
      Animated.timing(height, {
        toValue: 8,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isActive, delay]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        {
          height,
          backgroundColor: isActive ? '#FF3B30' : NotesColors.textSecondary,
        },
      ]}
    />
  );
}

// Compact wave visualization
function MiniWaveform({ isActive }: { isActive: boolean }) {
  const bars = [0, 30, 60, 90, 120];

  return (
    <View style={styles.miniWaveContainer}>
      {bars.map((delay, index) => (
        <WaveBar key={index} delay={delay} isActive={isActive} />
      ))}
    </View>
  );
}

export function RecordingOverlay({
  isRecording,
  isPaused,
  duration,
  recordingUri,
  destination,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onCancel,
  onProcess,
  onAddToNote,
  onIntoFolder,
}: RecordingOverlayProps) {
  const [notes, setNotes] = useState('');
  const [savedAudioUri, setSavedAudioUri] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const textInputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation for mic moving to corner
  const micScale = useRef(new Animated.Value(1)).current;
  const micOpacity = useRef(new Animated.Value(1)).current;

  // Determine if mic should be in corner (user is typing)
  const isTyping = notes.length > 0 || isInputFocused;
  const showMicInCorner = isTyping && !isRecording;

  // Track saved recording URI
  React.useEffect(() => {
    if (recordingUri) {
      setSavedAudioUri(recordingUri);
    }
  }, [recordingUri]);

  // Animate mic when typing state changes
  useEffect(() => {
    if (showMicInCorner) {
      Animated.parallel([
        Animated.spring(micScale, {
          toValue: 0.55,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(micOpacity, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(micScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(micOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showMicInCorner]);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMicPress = async () => {
    if (isRecording) {
      if (isPaused) {
        onResumeRecording();
      } else {
        // Just stop recording, don't process yet
        const uri = await onStopRecording();
        if (uri) {
          setSavedAudioUri(uri);
        }
      }
    } else {
      // Start new recording (clear previous if any)
      setSavedAudioUri(null);
      onStartRecording();
    }
  };

  const handleProcess = () => {
    Keyboard.dismiss();
    // Process with AI - pass notes and audio URI if available
    onProcess(notes, savedAudioUri || recordingUri);
  };

  const canProcess = notes.trim().length > 0 || savedAudioUri || recordingUri || duration > 0;
  const hasRecording = duration > 0 || !!savedAudioUri || !!recordingUri;
  const hasStoppedRecording = !!savedAudioUri || !!recordingUri;

  // Determine header title based on destination
  const getHeaderTitle = () => {
    if (!destination) return 'New Note';
    if (destination.type === 'note') {
      return (
        <View style={styles.destinationHeader}>
          <Text style={styles.destinationPrefix}>Recording</Text>
          <Ionicons name="arrow-forward" size={14} color={NotesColors.textSecondary} />
          <Text style={styles.destinationName} numberOfLines={1}>{destination.name}</Text>
        </View>
      );
    }
    if (destination.type === 'folder') {
      return (
        <View style={styles.destinationHeader}>
          <Text style={styles.destinationPrefix}>Recording</Text>
          <Ionicons name="arrow-forward" size={14} color={NotesColors.textSecondary} />
          <Ionicons name="folder" size={14} color={NotesColors.primary} />
          <Text style={styles.destinationName} numberOfLines={1}>{destination.name}</Text>
        </View>
      );
    }
    return 'New Note';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close" size={28} color={NotesColors.textSecondary} />
        </TouchableOpacity>
        {typeof getHeaderTitle() === 'string' ? (
          <Text style={styles.title}>{getHeaderTitle()}</Text>
        ) : (
          getHeaderTitle()
        )}
        <View style={styles.headerRight}>
          {hasRecording && !showMicInCorner && (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingBadgeText}>Audio</Text>
            </View>
          )}
          {/* Mic in corner when typing */}
          {showMicInCorner && (
            <Animated.View style={{ transform: [{ scale: micScale }], opacity: micOpacity }}>
              <TouchableOpacity
                style={styles.micButtonSmall}
                onPress={handleMicPress}
                activeOpacity={0.7}
              >
                <Ionicons name="mic" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Main text area */}
      <View style={styles.textContainer}>
        <TextInput
          ref={textInputRef}
          style={styles.textInput}
          placeholder="What's on your mind?"
          placeholderTextColor={NotesColors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          multiline
          textAlignVertical="top"
          autoFocus={false}
        />
      </View>

      {/* Bottom controls - centered and stacked */}
      <View style={styles.bottomControls}>
        {/* Mic / Recording control - centered (hidden when typing, mic moves to corner) */}
        {isRecording && !isPaused ? (
          // Recording in progress - always show wave and stop button at bottom
          <View style={styles.micContainer}>
            <TouchableOpacity
              style={styles.recordingActiveContainer}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.recordingIndicator,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <MiniWaveform isActive={true} />
              </Animated.View>
              <Text style={styles.timerText}>{formatTime(duration)}</Text>
              <View style={styles.stopHint}>
                <View style={styles.stopIcon} />
              </View>
            </TouchableOpacity>
          </View>
        ) : isRecording && isPaused ? (
          // Paused - show paused state
          <View style={styles.micContainer}>
            <TouchableOpacity
              style={styles.recordingActiveContainer}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <View style={styles.pausedIndicator}>
                <Ionicons name="pause" size={16} color={NotesColors.textSecondary} />
              </View>
              <Text style={styles.timerTextPaused}>{formatTime(duration)}</Text>
              <Ionicons name="play" size={18} color={NotesColors.primary} />
            </TouchableOpacity>
          </View>
        ) : hasStoppedRecording ? (
          // Has recording that was stopped - show completed state
          <View style={styles.micContainer}>
            <View style={styles.recordingActiveContainer}>
              <View style={styles.completedIndicator}>
                <Ionicons name="checkmark" size={14} color="#4CAF50" />
              </View>
              <Text style={styles.timerTextComplete}>{formatTime(duration)}</Text>
              <TouchableOpacity onPress={() => { setSavedAudioUri(null); onStartRecording(); }}>
                <Ionicons name="refresh" size={18} color={NotesColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : !showMicInCorner ? (
          // No recording yet and not typing - show big mic button
          <View style={styles.micContainer}>
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <Ionicons name="mic" size={36} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Secondary action buttons - only show when no destination set and not recording */}
        {!destination && !isRecording && !hasStoppedRecording && !showMicInCorner && onAddToNote && onIntoFolder && (
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => onAddToNote(notes, savedAudioUri || recordingUri)}
              activeOpacity={0.7}
            >
              <Ionicons name="attach" size={18} color={NotesColors.primary} />
              <Text style={styles.secondaryButtonText}>Add to...</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => onIntoFolder(notes, savedAudioUri || recordingUri)}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-outline" size={18} color={NotesColors.primary} />
              <Text style={styles.secondaryButtonText}>Into...</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Process button - show when there's content */}
        {canProcess && (
          <TouchableOpacity
            style={[styles.processButton, isRecording && styles.processButtonDisabled]}
            onPress={handleProcess}
            disabled={isRecording}
            activeOpacity={0.7}
          >
            <Ionicons
              name="sparkles"
              size={16}
              color={!isRecording ? '#FFFFFF' : NotesColors.textSecondary}
            />
            <Text style={[
              styles.processButtonText,
              isRecording && styles.processButtonTextDisabled
            ]}>
              Process
            </Text>
          </TouchableOpacity>
        )}

        {/* Helper text - only show when not typing */}
        {!showMicInCorner && (
          <Text style={styles.helperText}>
            {isRecording && !isPaused
              ? 'Tap to stop recording'
              : isRecording && isPaused
              ? 'Tap to resume'
              : hasStoppedRecording
              ? 'Audio attached'
              : 'Tap mic to record'}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NotesColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  cancelButton: {
    padding: 4,
    width: 80,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: NotesColors.textPrimary,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 200,
  },
  destinationPrefix: {
    fontSize: 15,
    color: NotesColors.textSecondary,
  },
  destinationName: {
    fontSize: 15,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    flexShrink: 1,
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },
  recordingBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF3B30',
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: NotesColors.textPrimary,
    lineHeight: 26,
  },
  bottomControls: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  micContainer: {
    alignItems: 'center',
  },
  recordingActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingIndicator: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 24,
    padding: 10,
  },
  miniWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 24,
    width: 36,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  timerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
    fontVariant: ['tabular-nums'],
    minWidth: 45,
  },
  timerTextPaused: {
    fontSize: 15,
    fontWeight: '500',
    color: NotesColors.textSecondary,
    fontVariant: ['tabular-nums'],
    minWidth: 45,
  },
  timerTextComplete: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4CAF50',
    fontVariant: ['tabular-nums'],
    minWidth: 45,
  },
  stopHint: {
    backgroundColor: NotesColors.card,
    borderRadius: 12,
    padding: 6,
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FF3B30',
  },
  pausedIndicator: {
    backgroundColor: NotesColors.card,
    borderRadius: 16,
    padding: 6,
  },
  completedIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 16,
    padding: 6,
  },
  micButton: {
    backgroundColor: NotesColors.primary,
    borderRadius: 40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonSmall: {
    backgroundColor: NotesColors.primary,
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NotesColors.aiPanelBackground,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: NotesColors.primary,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NotesColors.primary,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 5,
  },
  processButtonDisabled: {
    backgroundColor: NotesColors.card,
  },
  processButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  processButtonTextDisabled: {
    color: NotesColors.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: NotesColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
