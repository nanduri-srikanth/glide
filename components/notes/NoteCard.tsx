import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { NotesColors } from '@/constants/theme';
import { Note } from '@/data/types';
import { formatRelativeTime, formatDuration } from '@/data/mockNotes';
import { ActionBadge } from './ActionBadge';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
}

export function NoteCard({ note, onPress }: NoteCardProps) {
  const hasCalendarActions = note.actions.calendar.length > 0;
  const hasEmailActions = note.actions.email.length > 0;
  const hasReminderActions = note.actions.reminders.length > 0;

  // Get preview text (first line of transcript)
  const previewText = note.transcript.split('\n')[0].slice(0, 80);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(note.timestamp)}</Text>
      </View>

      <Text style={styles.preview} numberOfLines={2}>
        {previewText}...
      </Text>

      <View style={styles.footer}>
        <View style={styles.badges}>
          {hasCalendarActions && (
            <ActionBadge type="calendar" count={note.actions.calendar.length} />
          )}
          {hasEmailActions && (
            <ActionBadge type="email" count={note.actions.email.length} />
          )}
          {hasReminderActions && (
            <ActionBadge type="reminder" count={note.actions.reminders.length} />
          )}
        </View>
        <Text style={styles.duration}>{formatDuration(note.duration)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: NotesColors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginRight: 8,
  },
  time: {
    fontSize: 13,
    color: NotesColors.textSecondary,
  },
  preview: {
    fontSize: 14,
    color: NotesColors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  duration: {
    fontSize: 12,
    color: NotesColors.textSecondary,
  },
});
