/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#636B2F';  // Dark Olive (Mossy Hollow)
const tintColorDark = '#fff';

// Notes App Mossy Hollow Color Scheme - Light Mode
// Inspired by Figma's Mossy Hollow palette
export const NotesColors = {
  primary: '#636B2F',      // Dark Olive - Folder icons, selected states, primary buttons
  secondary: '#34542C',    // Forest Green - Action badges, highlights, active elements
  accent: '#AE5264',       // Mauve - Links, CTAs, contrast accents
  background: '#F7F8F2',   // Soft sage white background
  card: '#E8EBD9',         // Light sage card backgrounds
  textPrimary: '#3D4127',  // Deep Forest - Dark text
  textSecondary: '#6B7255', // Muted olive - Gray text
  // Derived colors for AI Summary Panel
  aiPanelBackground: 'rgba(99, 107, 47, 0.08)',
  aiPanelBorder: 'rgba(99, 107, 47, 0.3)',
  // Action badge colors
  calendarBadge: '#636B2F',  // Dark Olive
  emailBadge: '#34542C',     // Forest Green
  reminderBadge: '#AE5264',  // Mauve
};

export const Colors = {
  light: {
    text: '#3D4127',
    background: '#F7F8F2',
    tint: '#636B2F',
    icon: '#6B7255',
    tabIconDefault: '#6B7255',
    tabIconSelected: '#636B2F',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
