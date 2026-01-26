import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';
import { FolderCard } from '@/components/notes/FolderCard';
import { SearchBar } from '@/components/notes/SearchBar';
import { ComposeButton } from '@/components/notes/ComposeButton';
import { useNotes } from '@/context/NotesContext';
import { useAuth } from '@/context/AuthContext';
import { Folder } from '@/data/types';
import { mockFolders } from '@/data/mockFolders';

export default function FoldersScreen() {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { folders, isLoading, error, fetchFolders } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isAuthenticated) fetchFolders();
  }, [isAuthenticated, fetchFolders]);

  const displayFolders: Folder[] = folders.length > 0
    ? folders.map(f => ({ id: f.id, name: f.name, icon: f.icon, noteCount: f.note_count, color: f.color || undefined, isSystem: f.is_system }))
    : mockFolders;

  const filteredFolders = displayFolders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFolderPress = (folder: Folder) => router.push(`/notes/${folder.id}`);
  const handleComposePress = () => router.push('/recording');
  const handleMicPress = () => router.push('/recording');

  const handleAddFolder = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to create folders.');
      return;
    }

    Alert.prompt(
      'New Folder',
      'Enter a name for this folder',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name) => {
            if (name?.trim()) {
              const { notesService } = await import('@/services/notes');
              const { data, error } = await notesService.createFolder({
                name: name.trim(),
                icon: 'folder',
              });

              if (error) {
                Alert.alert('Error', error);
                return;
              }

              if (data) {
                await fetchFolders();
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

  const handleAuthPress = () => {
    if (isAuthenticated) {
      Alert.alert(
        'Account',
        `Signed in as ${user?.email || 'User'}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
        ]
      );
    } else {
      router.push('/auth');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isAuthenticated) await fetchFolders();
    setRefreshing(false);
  }, [isAuthenticated, fetchFolders]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => !prev);
    setSelectedFolders(new Set());
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      {!isAuthenticated && (
        <TouchableOpacity style={styles.signInBanner} onPress={handleAuthPress}>
          <Ionicons name="log-in-outline" size={16} color={NotesColors.primary} />
          <Text style={styles.signInBannerText}>Sign in to sync your notes</Text>
          <Ionicons name="chevron-forward" size={16} color={NotesColors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFolder = ({ item }: { item: Folder }) => (
    <FolderCard folder={item} onPress={() => handleFolderPress(item)} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Folders</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconButton} onPress={handleAuthPress}>
            <Ionicons
              name={isAuthenticated ? 'person-circle' : 'person-circle-outline'}
              size={28}
              color={isAuthenticated ? NotesColors.primary : NotesColors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleAddFolder}>
            <View style={styles.addFolderIcon}>
              <Ionicons name="folder-outline" size={24} color={NotesColors.primary} />
              <View style={styles.addBadge}>
                <Ionicons name="add" size={12} color={NotesColors.textPrimary} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editButton} onPress={toggleEditMode}>
            <Text style={isEditMode ? styles.doneText : styles.editText}>
              {isEditMode ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredFolders}
        renderItem={renderFolder}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? <ActivityIndicator size="large" color={NotesColors.primary} /> : <Text style={styles.emptyText}>{error || 'No folders found'}</Text>}
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NotesColors.primary} />}
      />

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} onMicPress={handleMicPress} placeholder="Search" />
      <ComposeButton onPress={handleComposePress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NotesColors.background },
  titleContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '700', color: NotesColors.textPrimary },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { padding: 4 },
  addFolderIcon: { position: 'relative' },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: NotesColors.primary,
    borderRadius: 6,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: { padding: 4 },
  editText: { fontSize: 17, color: NotesColors.primary },
  doneText: { fontSize: 17, fontWeight: '600', color: NotesColors.primary },
  header: { marginBottom: 8 },
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(98, 69, 135, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  signInBannerText: { flex: 1, fontSize: 14, color: NotesColors.textPrimary },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 17, color: NotesColors.textSecondary },
});
