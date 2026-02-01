import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { initializeDatabase } from '../services/db';
import { syncEngine, SyncProgress, SyncResult, SyncState } from '../services/sync';
import { audioUploadManager, AudioUpload } from '../services/audio';
import { foldersRepository } from '../services/repositories';
import { useNetwork } from './NetworkContext';

interface SyncContextType {
  // Initialization
  isInitialized: boolean;
  isHydrated: boolean;
  initError: string | null;

  // Sync state
  syncState: SyncState;
  syncProgress: SyncProgress | null;
  lastSyncAt: string | null;
  pendingChangesCount: number;

  // Audio uploads
  pendingUploadsCount: number;
  pendingUploadsSize: number;
  audioUploads: AudioUpload[];

  // Actions
  sync: () => Promise<SyncResult>;
  processAudioUploads: () => Promise<void>;
  refreshPendingCounts: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: React.ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const { isOnline } = useNetwork();

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Sync state
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);

  // Audio uploads
  const [pendingUploadsCount, setPendingUploadsCount] = useState(0);
  const [pendingUploadsSize, setPendingUploadsSize] = useState(0);
  const [audioUploads, setAudioUploads] = useState<AudioUpload[]>([]);

  // Refs for tracking
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastSyncTimeRef = useRef<number>(0);

  // Initialize database and check hydration status
  useEffect(() => {
    async function initialize() {
      try {
        console.log('[SyncContext] Initializing database...');
        await initializeDatabase();

        // Ensure default folders exist locally
        await foldersRepository.setupDefaultFolders();

        const hydrated = await syncEngine.isHydrated();
        setIsHydrated(hydrated);

        const lastSync = await syncEngine.getLastSyncAt();
        setLastSyncAt(lastSync);

        setIsInitialized(true);
        console.log('[SyncContext] Initialization complete, hydrated:', hydrated);

        // Refresh counts
        await refreshPendingCounts();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to initialize';
        console.error('[SyncContext] Initialization failed:', errorMsg);
        setInitError(errorMsg);
      }
    }

    initialize();
  }, []);

  // Set up sync engine progress callback
  useEffect(() => {
    syncEngine.onProgress((progress) => {
      setSyncState(progress.state);
      setSyncProgress(progress);
    });

    audioUploadManager.onProgress((upload) => {
      setAudioUploads(prev => {
        const index = prev.findIndex(u => u.id === upload.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = upload;
          return updated;
        }
        return [...prev, upload];
      });
    });
  }, []);

  // Sync when coming back online or trigger initial hydration
  useEffect(() => {
    if (isOnline && isInitialized) {
      const now = Date.now();
      // Debounce - don't sync more than once per 30 seconds
      if (now - lastSyncTimeRef.current > 30000) {
        if (!isHydrated) {
          // First launch - do initial hydration
          console.log('[SyncContext] Online and initialized, triggering initial hydration');
          lastSyncTimeRef.current = now;
          sync(); // sync() handles hydration internally if not hydrated
        } else {
          // Already hydrated - do incremental sync
          console.log('[SyncContext] Online and initialized, triggering sync');
          lastSyncTimeRef.current = now;
          sync();
        }
      }
    }
  }, [isOnline, isInitialized, isHydrated]);

  // Sync on app foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isOnline &&
        isInitialized
      ) {
        const now = Date.now();
        // Debounce - don't sync more than once per 30 seconds
        if (now - lastSyncTimeRef.current > 30000) {
          console.log('[SyncContext] App foregrounded, triggering sync');
          lastSyncTimeRef.current = now;
          sync(); // sync() handles hydration internally if not hydrated
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isOnline, isInitialized]);

  // Refresh pending counts
  const refreshPendingCounts = useCallback(async () => {
    try {
      const syncCount = await syncEngine.getPendingCount();
      setPendingChangesCount(syncCount);

      const uploadCount = await audioUploadManager.getPendingCount();
      setPendingUploadsCount(uploadCount);

      const uploadSize = await audioUploadManager.getPendingSize();
      setPendingUploadsSize(uploadSize);

      const uploads = await audioUploadManager.getAllUploads();
      setAudioUploads(uploads.filter(u => u.status !== 'completed'));
    } catch (error) {
      console.error('[SyncContext] Failed to refresh pending counts:', error);
    }
  }, []);

  // Perform sync
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline) {
      return {
        success: false,
        pushed: { notes: 0, folders: 0, actions: 0 },
        pulled: { notes: 0, folders: 0 },
        conflicts: 0,
        errors: ['No network connection'],
      };
    }

    if (!isInitialized) {
      return {
        success: false,
        pushed: { notes: 0, folders: 0, actions: 0 },
        pulled: { notes: 0, folders: 0 },
        conflicts: 0,
        errors: ['Not initialized'],
      };
    }

    // If not hydrated, do initial hydration first
    if (!isHydrated) {
      try {
        await syncEngine.hydrate();
        setIsHydrated(true);
      } catch (error) {
        return {
          success: false,
          pushed: { notes: 0, folders: 0, actions: 0 },
          pulled: { notes: 0, folders: 0 },
          conflicts: 0,
          errors: [error instanceof Error ? error.message : 'Hydration failed'],
        };
      }
    }

    const result = await syncEngine.sync();

    // Update last sync time
    const syncTime = await syncEngine.getLastSyncAt();
    setLastSyncAt(syncTime);

    // Refresh counts
    await refreshPendingCounts();

    // Process audio uploads after sync
    if (isOnline) {
      await processAudioUploads();
    }

    return result;
  }, [isOnline, isInitialized, isHydrated, refreshPendingCounts]);

  // Process audio uploads
  const processAudioUploads = useCallback(async () => {
    if (!isOnline) return;

    try {
      const result = await audioUploadManager.processAll();
      console.log(`[SyncContext] Processed ${result.processed} audio uploads`);

      // Refresh counts
      await refreshPendingCounts();
    } catch (error) {
      console.error('[SyncContext] Audio upload processing failed:', error);
    }
  }, [isOnline, refreshPendingCounts]);

  const value: SyncContextType = {
    isInitialized,
    isHydrated,
    initError,
    syncState,
    syncProgress,
    lastSyncAt,
    pendingChangesCount,
    pendingUploadsCount,
    pendingUploadsSize,
    audioUploads,
    sync,
    processAudioUploads,
    refreshPendingCounts,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextType {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export default SyncContext;
