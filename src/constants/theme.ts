export const Colors = {
  light: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceMuted: '#EDF1F5',
    text: '#12212E',
    textMuted: '#5B6B7A',
    border: '#DDE5EC',
    primary: '#0E5AA7',
    primaryMuted: '#E3EEF9',
    onPrimary: '#FFFFFF',
    success: '#1F8A4C',
    successMuted: '#E4F5EB',
    warning: '#B27B0A',
    warningMuted: '#FCF3DD',
    danger: '#C0392B',
    dangerMuted: '#FBEAE7',
    info: '#0E5AA7',
    infoMuted: '#E3EEF9',
    tabActive: '#0E5AA7',
    tabInactive: '#7C8B99',
  },
  dark: {
    background: '#0D141B',
    surface: '#16202B',
    surfaceMuted: '#1E2B38',
    text: '#E8EEF4',
    textMuted: '#93A5B5',
    border: '#253443',
    primary: '#5FA8E8',
    primaryMuted: '#1B3A57',
    onPrimary: '#0B1723',
    success: '#57C389',
    successMuted: '#173427',
    warning: '#E5B45C',
    warningMuted: '#3B2F14',
    danger: '#E8786A',
    dangerMuted: '#3B1D18',
    info: '#5FA8E8',
    infoMuted: '#1B3A57',
    tabActive: '#5FA8E8',
    tabInactive: '#5F7182',
  },
} as const;

export type ThemeColors = (typeof Colors)['light'];

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const Typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  metric: { fontSize: 28, fontWeight: '700' as const },
} as const;
