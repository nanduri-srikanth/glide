import { useEffect, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import 'react-native-reanimated';

import { NotesColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotesProvider } from '@/context/NotesContext';
import { NetworkProvider } from '@/context/NetworkContext';
import { SyncProvider } from '@/context/SyncContext';
import { useNavigationPersistence } from '@/hooks/useNavigationPersistence';

// Deep link URL parsing
const parseDeepLink = (url: string): { action: string; params: Record<string, string> } | null => {
  try {
    const parsed = Linking.parse(url);
    // Handle glide://record or glide://record?param=value
    if (parsed.path === 'record' || parsed.hostname === 'record') {
      return {
        action: 'record',
        params: (parsed.queryParams || {}) as Record<string, string>,
      };
    }
    return null;
  } catch {
    return null;
  }
};

// DEV MODE: Set to true to skip authentication for testing
const DEV_SKIP_AUTH = true;

export const unstable_settings = {
  anchor: '(tabs)',
};

const PurpleLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: NotesColors.primary,
    background: NotesColors.background,
    card: NotesColors.card,
    text: NotesColors.textPrimary,
    border: '#E0E0E0',
    notification: NotesColors.secondary,
  },
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingDeepLink = useRef<string | null>(null);
  const hasHandledInitialLink = useRef(false);

  // Persist and restore navigation state (only when auth is ready)
  useNavigationPersistence(!isLoading);

  // Handle deep link navigation
  const handleDeepLink = useCallback((url: string) => {
    const parsed = parseDeepLink(url);
    if (parsed?.action === 'record') {
      // Navigate to recording screen with auto-start
      router.push({
        pathname: '/recording',
        params: { autoStart: 'true' },
      });
    }
  }, [router]);

  // Listen for deep links
  useEffect(() => {
    // Handle initial URL when app opens from deep link
    const handleInitialURL = async () => {
      if (hasHandledInitialLink.current) return;

      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        hasHandledInitialLink.current = true;
        if (isLoading) {
          // Store for later when auth is ready
          pendingDeepLink.current = initialURL;
        } else {
          handleDeepLink(initialURL);
        }
      }
    };

    handleInitialURL();

    // Listen for URL events while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      if (isLoading) {
        pendingDeepLink.current = event.url;
      } else {
        handleDeepLink(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoading, handleDeepLink]);

  // Handle pending deep link after auth loads
  useEffect(() => {
    if (!isLoading && pendingDeepLink.current) {
      const url = pendingDeepLink.current;
      pendingDeepLink.current = null;
      // Small delay to ensure navigation is ready
      setTimeout(() => handleDeepLink(url), 100);
    }
  }, [isLoading, handleDeepLink]);

  useEffect(() => {
    // Skip auth redirect in dev mode (but still wait for loading)
    if (DEV_SKIP_AUTH) return;

    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to auth screen if not authenticated and not already there
      router.replace('/auth');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated and on auth screen
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Always show loading screen while auth is being checked
  // This ensures auto-login completes before showing the app
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={NotesColors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={PurpleLightTheme}>
      <AuthGuard>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: NotesColors.background },
            headerTintColor: NotesColors.textPrimary,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: NotesColors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notes" options={{ headerShown: false }} />
          <Stack.Screen name="recording" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack>
      </AuthGuard>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <NetworkProvider>
      <SyncProvider>
        <AuthProvider>
          <NotesProvider>
            <RootLayoutNav />
          </NotesProvider>
        </AuthProvider>
      </SyncProvider>
    </NetworkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NotesColors.background,
  },
});
