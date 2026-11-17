import { Platform } from 'react-native';

// Aura-Dark palette for the customer app. Values follow the mobile brief, which differs from the web portals' tokens.
export const COLORS = {
  canvas: '#090A0F',
  s1: '#11131A',
  s2: '#181B24',
  s3: '#202430',
  line: 'rgba(255, 255, 255, 0.08)',
  line2: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#F4F6FB',
  textSecondary: '#A3A9BA',
  textMuted: '#6B7185',
  accentBlue: '#2B7FFF',
  accentBlueGlow: 'rgba(43, 127, 255, 0.25)',
  accentEmerald: '#10B981',
  accentAmber: '#FFB020',
  accentRed: '#FF5A6E',
  accentViolet: '#8B6CFF',
} as const;

export const RADIUS = { md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const FONT_MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
