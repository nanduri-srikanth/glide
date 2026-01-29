import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import {
  CalendarAction,
  EmailAction,
  ReminderAction,
  NextStepAction,
  EditableAction,
} from '@/data/types';

type ActionType = 'calendar' | 'email' | 'reminder' | 'nextStep';

interface EditableActionCardProps {
  action: EditableAction;
  type: ActionType;
  onUpdate: (action: EditableAction) => void;
  onDelete: (actionId: string) => void;
  onExecute?: (actionId: string, service: 'google' | 'apple') => void;
}

export function EditableActionCard({
  action,
  type,
  onUpdate,
  onDelete,
  onExecute,
}: EditableActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteThreshold = -80;

  // Pan responder for swipe-to-delete
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -100));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < deleteThreshold) {
          // Animate off screen and delete
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onDelete(action.id));
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const getIcon = (): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (type) {
      case 'calendar':
        return { name: 'calendar', color: NotesColors.calendarBadge };
      case 'email':
        return { name: 'mail', color: NotesColors.emailBadge };
      case 'reminder':
        return { name: 'alarm', color: NotesColors.reminderBadge };
      case 'nextStep':
        return { name: 'play-forward', color: NotesColors.primary };
    }
  };

  const icon = getIcon();

  const handleFieldChange = (field: string, value: string) => {
    onUpdate({ ...action, [field]: value, isModified: true });
  };

  const renderCalendarContent = () => {
    const calAction = action as CalendarAction;
    return (
      <>
        {isEditing ? (
          <TextInput
            style={styles.editableTitle}
            value={calAction.title}
            onChangeText={(text) => handleFieldChange('title', text)}
            placeholder="Event title"
            placeholderTextColor={NotesColors.textSecondary}
          />
        ) : (
          <Text style={styles.actionTitle}>{calAction.title}</Text>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={12} color={NotesColors.textSecondary} />
          {isEditing ? (
            <TextInput
              style={styles.editableDetail}
              value={calAction.date}
              onChangeText={(text) => handleFieldChange('date', text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={NotesColors.textSecondary}
            />
          ) : (
            <Text style={styles.detailText}>{calAction.date}</Text>
          )}
          {calAction.time && (
            <>
              <Text style={styles.detailText}> at </Text>
              {isEditing ? (
                <TextInput
                  style={styles.editableDetail}
                  value={calAction.time}
                  onChangeText={(text) => handleFieldChange('time', text)}
                  placeholder="HH:MM"
                  placeholderTextColor={NotesColors.textSecondary}
                />
              ) : (
                <Text style={styles.detailText}>{calAction.time}</Text>
              )}
            </>
          )}
        </View>
        {!isEditing && calAction.status === 'pending' && onExecute && (
          <View style={styles.executeButtons}>
            <TouchableOpacity
              style={styles.executeButton}
              onPress={() => onExecute(action.id, 'google')}
            >
              <Ionicons name="logo-google" size={12} color={NotesColors.textPrimary} />
              <Text style={styles.executeButtonText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.executeButton}
              onPress={() => onExecute(action.id, 'apple')}
            >
              <Ionicons name="logo-apple" size={12} color={NotesColors.textPrimary} />
              <Text style={styles.executeButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  const renderEmailContent = () => {
    const emailAction = action as EmailAction;
    return (
      <>
        <View style={styles.detailRow}>
          <Text style={styles.labelText}>To: </Text>
          {isEditing ? (
            <TextInput
              style={styles.editableDetail}
              value={emailAction.to}
              onChangeText={(text) => handleFieldChange('to', text)}
              placeholder="recipient@email.com"
              placeholderTextColor={NotesColors.textSecondary}
            />
          ) : (
            <Text style={styles.actionTitle}>{emailAction.to}</Text>
          )}
        </View>
        {isEditing ? (
          <TextInput
            style={styles.editableTitle}
            value={emailAction.subject}
            onChangeText={(text) => handleFieldChange('subject', text)}
            placeholder="Subject line"
            placeholderTextColor={NotesColors.textSecondary}
          />
        ) : (
          <Text style={styles.detailText} numberOfLines={1}>{emailAction.subject}</Text>
        )}
        {emailAction.preview && !isEditing && (
          <Text style={styles.previewText} numberOfLines={2}>{emailAction.preview}</Text>
        )}
        {isEditing && (
          <TextInput
            style={[styles.editableDetail, styles.multilineInput]}
            value={emailAction.body || emailAction.preview}
            onChangeText={(text) => handleFieldChange('body', text)}
            placeholder="Email body..."
            placeholderTextColor={NotesColors.textSecondary}
            multiline
          />
        )}
      </>
    );
  };

  const renderReminderContent = () => {
    const reminderAction = action as ReminderAction;
    return (
      <>
        {isEditing ? (
          <TextInput
            style={styles.editableTitle}
            value={reminderAction.title}
            onChangeText={(text) => handleFieldChange('title', text)}
            placeholder="Reminder title"
            placeholderTextColor={NotesColors.textSecondary}
          />
        ) : (
          <Text style={styles.actionTitle}>{reminderAction.title}</Text>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={12} color={NotesColors.textSecondary} />
          {isEditing ? (
            <TextInput
              style={styles.editableDetail}
              value={reminderAction.dueDate}
              onChangeText={(text) => handleFieldChange('dueDate', text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={NotesColors.textSecondary}
            />
          ) : (
            <Text style={styles.detailText}>Due: {reminderAction.dueDate}</Text>
          )}
        </View>
        <View style={styles.priorityRow}>
          {(['low', 'medium', 'high'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityChip,
                reminderAction.priority === p && styles.priorityChipActive,
                { backgroundColor: getPriorityColor(p, reminderAction.priority === p) },
              ]}
              onPress={() => handleFieldChange('priority', p)}
              disabled={!isEditing}
            >
              <Text style={[
                styles.priorityText,
                reminderAction.priority === p && styles.priorityTextActive,
              ]}>
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  const renderNextStepContent = () => {
    const nextStepAction = action as NextStepAction;
    return (
      <View style={styles.nextStepRow}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => handleFieldChange('status', nextStepAction.status === 'completed' ? 'pending' : 'completed')}
        >
          <Ionicons
            name={nextStepAction.status === 'completed' ? 'checkbox' : 'square-outline'}
            size={20}
            color={nextStepAction.status === 'completed' ? NotesColors.primary : NotesColors.textSecondary}
          />
        </TouchableOpacity>
        {isEditing ? (
          <TextInput
            style={[styles.editableTitle, styles.nextStepInput]}
            value={nextStepAction.title}
            onChangeText={(text) => handleFieldChange('title', text)}
            placeholder="Next step..."
            placeholderTextColor={NotesColors.textSecondary}
          />
        ) : (
          <Text style={[
            styles.actionTitle,
            nextStepAction.status === 'completed' && styles.completedText,
          ]}>
            {nextStepAction.title}
          </Text>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'calendar':
        return renderCalendarContent();
      case 'email':
        return renderEmailContent();
      case 'reminder':
        return renderReminderContent();
      case 'nextStep':
        return renderNextStepContent();
    }
  };

  const getPriorityColor = (priority: string, isActive: boolean) => {
    const opacity = isActive ? 0.4 : 0.15;
    switch (priority) {
      case 'high':
        return `rgba(239, 83, 80, ${opacity})`;
      case 'medium':
        return `rgba(255, 167, 38, ${opacity})`;
      default:
        return `rgba(102, 187, 106, ${opacity})`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Delete background */}
      <View style={styles.deleteBackground}>
        <Ionicons name="trash" size={20} color="#fff" />
      </View>

      {/* Card content */}
      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
            <Ionicons name={icon.name} size={14} color={icon.color} />
          </View>

          {action.source === 'user' && (
            <View style={styles.userBadge}>
              <Text style={styles.userBadgeText}>USER</Text>
            </View>
          )}

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
            >
              <Ionicons
                name={isEditing ? 'checkmark' : 'pencil'}
                size={16}
                color={NotesColors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(action.id)}
            >
              <Ionicons name="close" size={16} color={NotesColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardContent}>
          {renderContent()}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    position: 'relative',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: NotesColors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(98, 69, 135, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: NotesColors.primary,
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginBottom: 4,
  },
  editableTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: NotesColors.textPrimary,
    marginBottom: 4,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: NotesColors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: NotesColors.textSecondary,
  },
  editableDetail: {
    fontSize: 13,
    color: NotesColors.textSecondary,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: NotesColors.primary,
    minWidth: 80,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  labelText: {
    fontSize: 13,
    color: NotesColors.textSecondary,
    fontWeight: '500',
  },
  previewText: {
    fontSize: 13,
    color: NotesColors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  executeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(98, 69, 135, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  executeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: NotesColors.textPrimary,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  priorityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityChipActive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: NotesColors.textSecondary,
  },
  priorityTextActive: {
    color: NotesColors.textPrimary,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    padding: 2,
  },
  nextStepInput: {
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: NotesColors.textSecondary,
  },
});

export default EditableActionCard;
