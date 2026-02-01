import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/context/SyncContext';
import { AudioUpload } from '@/services/audio';

interface PendingUploadsListProps {
  onRetry?: () => void;
}

export function PendingUploadsList({ onRetry }: PendingUploadsListProps) {
  const { audioUploads, pendingUploadsSize, processAudioUploads } = useSync();

  const pendingUploads = audioUploads.filter(u => u.status !== 'completed');

  if (pendingUploads.length === 0) {
    return null;
  }

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'uploading': return 'cloud-upload-outline';
      case 'processing': return 'hourglass-outline';
      case 'failed': return 'alert-circle-outline';
      default: return 'checkmark-circle-outline';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'uploading': return '#2196F3';
      case 'processing': return '#9C27B0';
      case 'failed': return '#F44336';
      default: return '#4CAF50';
    }
  };

  const getStatusText = (upload: AudioUpload): string => {
    switch (upload.status) {
      case 'pending':
        return 'Waiting to upload';
      case 'uploading':
        return `Uploading ${Math.round(upload.uploadProgress * 100)}%`;
      case 'processing':
        return 'Processing...';
      case 'failed':
        return upload.lastError || 'Upload failed';
      default:
        return 'Unknown';
    }
  };

  const renderItem = ({ item }: { item: AudioUpload }) => (
    <View style={styles.item}>
      <View style={styles.itemIcon}>
        <Ionicons
          name={getStatusIcon(item.status)}
          size={20}
          color={getStatusColor(item.status)}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          Recording
        </Text>
        <Text style={[styles.itemStatus, { color: getStatusColor(item.status) }]}>
          {getStatusText(item)}
        </Text>
        {item.fileSize && (
          <Text style={styles.itemSize}>{formatSize(item.fileSize)}</Text>
        )}
      </View>
      {item.status === 'uploading' && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${item.uploadProgress * 100}%` },
            ]}
          />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Pending Uploads ({pendingUploads.length})
        </Text>
        <Text style={styles.headerSize}>
          {formatSize(pendingUploadsSize)}
        </Text>
      </View>
      <FlatList
        data={pendingUploads}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        scrollEnabled={false}
      />
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => processAudioUploads()}
      >
        <Ionicons name="refresh-outline" size={16} color="#007AFF" />
        <Text style={styles.retryButtonText}>Retry All</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  headerSize: {
    fontSize: 12,
    color: '#666',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  itemStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  itemSize: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: '#E0E0E0',
    borderRadius: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 6,
  },
});

export default PendingUploadsList;
