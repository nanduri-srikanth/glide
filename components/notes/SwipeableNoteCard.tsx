import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import { Note } from '@/data/types';
import { NoteCard } from './NoteCard';

interface SwipeableNoteCardProps {
  note: Note;
  onPress: () => void;
  onDelete: (noteId: string) => void;
  onMove: (noteId: string) => void;
  onPin?: (noteId: string) => void;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: (noteId: string) => void;
}

export function SwipeableNoteCard({
  note,
  onPress,
  onDelete,
  onMove,
  onPin,
  isEditMode,
  isSelected,
  onSelect,
}: SwipeableNoteCardProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const [showMenu, setShowMenu] = useState(false);
  const minusScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isEditMode) {
      // Animate minus button in
      Animated.spring(minusScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      // Reset animation
      Animated.timing(minusScaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [isEditMode]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            swipeableRef.current?.close();
            onDelete(note.id);
          },
        },
      ]
    );
  };

  const handleMove = () => {
    swipeableRef.current?.close();
    onMove(note.id);
  };

  const handleLongPress = () => {
    setShowMenu(true);
  };

  const handleMenuOption = (action: string) => {
    setShowMenu(false);
    switch (action) {
      case 'delete':
        handleDelete();
        break;
      case 'move':
        onMove(note.id);
        break;
      case 'pin':
        onPin?.(note.id);
        break;
    }
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [0, 160],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-160, -80, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.actionsContainer, { opacity, transform: [{ translateX }] }]}>
        {/* Move button */}
        <TouchableOpacity
          style={styles.moveButton}
          onPress={handleMove}
        >
          <Ionicons name="folder-outline" size={22} color="#fff" />
          <Text style={styles.actionText}>Move</Text>
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const handlePress = () => {
    if (isEditMode) {
      onSelect(note.id);
    } else {
      onPress();
    }
  };

  if (isEditMode) {
    return (
      <View style={styles.editModeContainer}>
        <Animated.View style={[styles.minusButton, { transform: [{ scale: minusScaleAnim }] }]}>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.minusCircle}>
              <Ionicons name="remove" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity
          style={styles.cardWrapper}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <NoteCard note={note} onPress={onPress} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
      >
        <Pressable onPress={onPress} onLongPress={handleLongPress} delayLongPress={500}>
          <NoteCard note={note} onPress={onPress} />
        </Pressable>
      </Swipeable>

      {/* Context Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle} numberOfLines={1}>{note.title}</Text>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleMenuOption('move')}
            >
              <Ionicons name="folder-outline" size={22} color={NotesColors.textPrimary} />
              <Text style={styles.menuOptionText}>Move to Folder</Text>
            </TouchableOpacity>

            {onPin && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => handleMenuOption('pin')}
              >
                <Ionicons name="pin-outline" size={22} color={NotesColors.textPrimary} />
                <Text style={styles.menuOptionText}>Pin Note</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleMenuOption('delete')}
            >
              <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  moveButton: {
    backgroundColor: NotesColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
    height: '100%',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
    height: '100%',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  editModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  minusButton: {
    marginRight: 8,
    zIndex: 1,
  },
  minusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    flex: 1,
  },
  // Context Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  menuContainer: {
    width: '100%',
    backgroundColor: NotesColors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: NotesColors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NotesColors.textSecondary,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuOptionText: {
    fontSize: 17,
    color: NotesColors.textPrimary,
  },
  menuCancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: NotesColors.primary,
  },
});
