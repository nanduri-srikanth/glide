import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string | null;
  isInternetReachable: boolean | null;
  lastOnlineAt: Date | null;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: React.ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);

  const subscriptionRef = useRef<NetInfoSubscription | null>(null);

  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    const reachable = state.isInternetReachable ?? false;
    const online = connected && reachable;

    setIsConnected(connected);
    setIsInternetReachable(state.isInternetReachable);
    setConnectionType(state.type);

    // Update online status
    if (online && !isOnline) {
      // Coming back online
      console.log('[Network] Connection restored');
    } else if (!online && isOnline) {
      // Going offline
      console.log('[Network] Connection lost');
      setLastOnlineAt(new Date());
    }

    setIsOnline(online);
  }, [isOnline]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      handleNetworkChange(state);
      return (state.isConnected ?? false) && (state.isInternetReachable ?? false);
    } catch (error) {
      console.error('[Network] Failed to check connection:', error);
      return false;
    }
  }, [handleNetworkChange]);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(handleNetworkChange);

    // Subscribe to changes
    subscriptionRef.current = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, [handleNetworkChange]);

  const value: NetworkContextType = {
    isOnline,
    isConnected,
    connectionType,
    isInternetReachable,
    lastOnlineAt,
    checkConnection,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export default NetworkContext;
