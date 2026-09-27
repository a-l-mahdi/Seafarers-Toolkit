import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settings-store';

/** Active color scheme: the user's theme choice in Settings, or the device
 *  scheme when it is set to "system". */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const preference = useSettingsStore((s) => s.theme);
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
