import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type SyncIndicatorStatus = 'synced' | 'pending' | 'uploading' | 'conflict' | 'error';

interface SyncIndicatorProps {
  status: SyncIndicatorStatus;
  size?: 'small' | 'medium';
}

/**
 * Small indicator icon to show sync status on note cards
 */
export function SyncIndicator({ status, size = 'small' }: SyncIndicatorProps) {
  const iconSize = size === 'small' ? 12 : 16;
  const containerSize = size === 'small' ? 16 : 20;

  // Don't show anything for synced items
  if (status === 'synced') {
    return null;
  }

  const getIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'pending': return 'cloud-upload-outline';
      case 'uploading': return 'cloud-upload';
      case 'conflict': return 'warning-outline';
      case 'error': return 'alert-circle-outline';
      default: return 'cloud-outline';
    }
  };

  const getColor = (): string => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'uploading': return '#2196F3';
      case 'conflict': return '#FF5722';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  if (status === 'uploading') {
    return (
      <View style={[styles.container, { width: containerSize, height: containerSize }]}>
        <ActivityIndicator size="small" color={getColor()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      <Ionicons name={getIcon()} size={iconSize} color={getColor()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SyncIndicator;
