import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotesColors } from '@/constants/theme';

export default function NotesLayout() {
  const router = useRouter();

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
      }}
    >
      <Stack.Screen
        name="[folderId]"
        options={{
          headerLargeTitle: true,
          headerLargeTitleStyle: {
            color: NotesColors.textPrimary,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -8 }}
            >
              <Ionicons name="chevron-back" size={28} color={NotesColors.primary} />
              <Text style={{ color: NotesColors.primary, fontSize: 17 }}>Folders</Text>
            </TouchableOpacity>
          ),
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
