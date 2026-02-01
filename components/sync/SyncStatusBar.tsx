import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '@/context/NetworkContext';
import { useSync } from '@/context/SyncContext';

interface SyncStatusBarProps {
  onPress?: () => void;
}

export function SyncStatusBar({ onPress }: SyncStatusBarProps) {
  const { isOnline } = useNetwork();
  const { syncState, pendingChangesCount, pendingUploadsCount, syncProgress } = useSync();

  // Don't show if online and no pending changes
  if (isOnline && pendingChangesCount === 0 && pendingUploadsCount === 0 && syncState === 'idle') {
    return null;
  }

  const totalPending = pendingChangesCount + pendingUploadsCount;
  const isSyncing = syncState === 'syncing';

  // Determine icon and message
  let icon: keyof typeof Ionicons.glyphMap = 'cloud-offline-outline';
  let message = 'Offline';
  let backgroundColor = '#F5F5F5';
  let textColor = '#666';

  if (!isOnline) {
    icon = 'cloud-offline-outline';
    message = totalPending > 0
      ? `Offline Mode • ${totalPending} change${totalPending !== 1 ? 's' : ''} pending`
      : 'Offline Mode';
    backgroundColor = '#FFF3E0';
    textColor = '#E65100';
  } else if (isSyncing) {
    icon = 'sync-outline';
    message = syncProgress?.currentOperation || 'Syncing...';
    backgroundColor = '#E3F2FD';
    textColor = '#1565C0';
  } else if (totalPending > 0) {
    icon = 'cloud-upload-outline';
    message = `${totalPending} change${totalPending !== 1 ? 's' : ''} pending`;
    backgroundColor = '#FFF8E1';
    textColor = '#F57F17';
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Ionicons
          name={icon}
          size={16}
          color={textColor}
          style={isSyncing ? styles.spinningIcon : undefined}
        />
        <Text style={[styles.text, { color: textColor }]}>
          {message}
        </Text>
      </View>
      {isSyncing && syncProgress && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${(syncProgress.processedCount / Math.max(syncProgress.totalCount, 1)) * 100}%`,
                backgroundColor: textColor,
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  spinningIcon: {
    // Animation will be handled by parent
  },
  progressContainer: {
    marginTop: 6,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
});

export default SyncStatusBar;
