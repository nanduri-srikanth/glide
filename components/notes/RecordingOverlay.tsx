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

interface RecordingOverlayProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  onStartRecording: () => void;
  onStopRecording: (notes?: string) => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onCancel: () => void;
  onSubmitTextOnly?: (notes: string) => void;
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
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onCancel,
  onSubmitTextOnly,
}: RecordingOverlayProps) {
  const [notes, setNotes] = useState('');
  const textInputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  const handleMicPress = () => {
    if (isRecording) {
      if (isPaused) {
        onResumeRecording();
      } else {
        onStopRecording(notes);
      }
    } else {
      onStartRecording();
    }
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (duration > 0) {
      // Has recording
      onStopRecording(notes);
    } else if (notes.trim()) {
      // Text only
      onSubmitTextOnly?.(notes);
    }
  };

  const canSubmit = notes.trim().length > 0 || duration > 0;
  const hasRecording = duration > 0;

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
        <Text style={styles.title}>New Note</Text>
        <View style={styles.headerRight}>
          {hasRecording && (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingBadgeText}>Audio</Text>
            </View>
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
          multiline
          textAlignVertical="top"
          autoFocus
        />
      </View>

      {/* Bottom bar with mic and submit */}
      <View style={styles.bottomBar}>
        {/* Recording controls */}
        <View style={styles.recordingSection}>
          {isRecording && !isPaused ? (
            // Recording in progress - show wave and stop button
            <TouchableOpacity
              style={styles.recordingControl}
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
          ) : isRecording && isPaused ? (
            // Paused - show paused state
            <TouchableOpacity
              style={styles.recordingControl}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <View style={styles.pausedIndicator}>
                <Ionicons name="pause" size={16} color={NotesColors.textSecondary} />
              </View>
              <Text style={styles.timerTextPaused}>{formatTime(duration)}</Text>
              <Ionicons name="play" size={18} color={NotesColors.primary} />
            </TouchableOpacity>
          ) : hasRecording ? (
            // Has recording but stopped
            <View style={styles.recordingControl}>
              <View style={styles.completedIndicator}>
                <Ionicons name="checkmark" size={14} color="#4CAF50" />
              </View>
              <Text style={styles.timerTextComplete}>{formatTime(duration)}</Text>
              <TouchableOpacity onPress={onStartRecording}>
                <Ionicons name="refresh" size={18} color={NotesColors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            // No recording yet - show mic button
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleMicPress}
              activeOpacity={0.7}
            >
              <Ionicons name="mic" size={22} color={NotesColors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-up"
            size={22}
            color={canSubmit ? NotesColors.textPrimary : NotesColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Helper text */}
      <View style={styles.helperContainer}>
        <Text style={styles.helperText}>
          {isRecording && !isPaused
            ? 'Tap waveform to stop recording'
            : isRecording && isPaused
            ? 'Tap to resume'
            : hasRecording
            ? 'Recording attached'
            : 'Tap mic to record audio'}
        </Text>
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
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: NotesColors.card,
  },
  recordingSection: {
    flex: 1,
  },
  recordingControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingIndicator: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderRadius: 20,
    padding: 8,
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
    borderRadius: 20,
    padding: 10,
  },
  submitButton: {
    backgroundColor: NotesColors.primary,
    borderRadius: 20,
    padding: 10,
  },
  submitButtonDisabled: {
    backgroundColor: NotesColors.card,
  },
  helperContainer: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: NotesColors.textSecondary,
    textAlign: 'center',
  },
});
