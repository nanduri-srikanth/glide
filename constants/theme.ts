/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#3D3D3D';  // Charcoal
const tintColorDark = '#fff';

// Notes App Clean Charcoal Color Scheme - Light Mode
// White background with charcoal icons and accents
export const NotesColors = {
  primary: '#3D3D3D',      // Charcoal - Folder icons, selected states, primary buttons
  secondary: '#5A5A5A',    // Medium charcoal - Action badges, highlights
  accent: '#2D2D2D',       // Dark charcoal - Links, CTAs
  background: '#FFFFFF',   // Pure white background
  card: '#F5F5F5',         // Light gray card backgrounds
  textPrimary: '#2D2D2D',  // Dark charcoal text
  textSecondary: '#7A7A7A', // Medium gray text
  // Derived colors for AI Summary Panel
  aiPanelBackground: 'rgba(61, 61, 61, 0.06)',
  aiPanelBorder: 'rgba(61, 61, 61, 0.2)',
  // Action badge colors
  calendarBadge: '#3D3D3D',  // Charcoal
  emailBadge: '#5A5A5A',     // Medium charcoal
  reminderBadge: '#7A7A7A',  // Gray
};

export const Colors = {
  light: {
    text: '#2D2D2D',
    background: '#FFFFFF',
    tint: '#3D3D3D',
    icon: '#7A7A7A',
    tabIconDefault: '#7A7A7A',
    tabIconSelected: '#3D3D3D',
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
