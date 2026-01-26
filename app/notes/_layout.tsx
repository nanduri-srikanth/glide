import { Stack } from 'expo-router';
import { NotesColors } from '@/constants/theme';

export default function NotesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: NotesColors.background,
        },
        headerTintColor: NotesColors.primary,
        headerTitleStyle: {
          fontWeight: '600',
          color: NotesColors.textPrimary,
        },
        contentStyle: {
          backgroundColor: NotesColors.background,
        },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="[folderId]"
        options={{
          headerLargeTitle: true,
          headerLargeTitleStyle: {
            color: NotesColors.textPrimary,
          },
        }}
      />
      <Stack.Screen
        name="detail/[noteId]"
        options={{
          title: '',
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}
