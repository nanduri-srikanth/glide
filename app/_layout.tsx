import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { NotesColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotesProvider } from '@/context/NotesContext';

// DEV MODE: Set to true to skip authentication for testing
const DEV_SKIP_AUTH = true;

export const unstable_settings = {
  anchor: '(tabs)',
};

const PurpleDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: NotesColors.primary,
    background: NotesColors.background,
    card: NotesColors.card,
    text: NotesColors.textPrimary,
    border: NotesColors.card,
    notification: NotesColors.secondary,
  },
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Skip auth redirect in dev mode
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

  // Skip loading screen in dev mode
  if (!DEV_SKIP_AUTH && isLoading) {
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
    <ThemeProvider value={PurpleDarkTheme}>
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
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotesProvider>
        <RootLayoutNav />
      </NotesProvider>
    </AuthProvider>
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
