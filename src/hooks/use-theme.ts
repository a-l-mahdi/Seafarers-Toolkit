/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, Ocean } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  return Colors[useColorScheme()];
}

export function useOcean() {
  return Ocean[useColorScheme()];
}
