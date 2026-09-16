import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Locale } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';
export type CalendarPreference = 'gregorian' | 'jalali';

interface SettingsState {
  locale: Locale;
  theme: ThemePreference;
  calendar: CalendarPreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  setCalendar: (calendar: CalendarPreference) => void;
}

const STORAGE_KEY = 'app.settings.v1';
type Persisted = Pick<SettingsState, 'locale' | 'theme' | 'calendar'>;

const DEFAULTS: Persisted = { locale: 'fa', theme: 'system', calendar: 'jalali' };

async function persist(patch: Partial<Persisted>): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    const current: Persisted = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Persisted) } : DEFAULTS;
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // non-fatal: settings stay in memory
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  locale: DEFAULTS.locale,
  theme: DEFAULTS.theme,
  calendar: DEFAULTS.calendar,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Persisted) };
        set({ ...parsed, hydrated: true });
        return;
      }
    } catch {
      // fall through
    }
    set({ hydrated: true });
  },
  setLocale: (locale) => {
    set({ locale });
    void persist({ locale });
  },
  setTheme: (theme) => {
    set({ theme });
    void persist({ theme });
  },
  setCalendar: (calendar) => {
    set({ calendar });
    void persist({ calendar });
  },
}));
