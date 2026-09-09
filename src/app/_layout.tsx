import { useEffect, useMemo, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import i18n, { isRTL } from '@/i18n';
import { openDatabase } from '@/database/db';
import { initNotifications, syncNotifications } from '@/services/notification-service';
import { useSettingsStore } from '@/store/settings-store';
import { listDocuments } from '@/database/repositories/documents-repository';

SplashScreen.preventAutoHideAsync();
I18nManager.allowRTL(true);

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const scheme = useColorScheme();
  const { locale, theme, hydrated, hydrate } = useSettingsStore();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await hydrate();
      await openDatabase();
      setDbReady(true);
      await initNotifications();
      try {
        const docs = await listDocuments();
        await syncNotifications(docs);
      } catch {
        // notifications sync is best-effort
      }
      await SplashScreen.hideAsync();
    })();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      void i18n.changeLanguage(locale);
      I18nManager.forceRTL(isRTL(locale));
    }
  }, [hydrated, locale]);

  const navigationTheme = useMemo(() => {
    const preferDark = theme === 'dark' || (theme === 'system' && scheme === 'dark');
    const base = preferDark ? DarkTheme : DefaultTheme;
    const colors = preferDark ? Colors.dark : Colors.light;
    return { ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text } };
  }, [theme, scheme]);

  if (!hydrated || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <SafeAreaProvider>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}
              edges={['top']}
            >
              <Stack
                screenOptions={{
                  headerShown: false,
                  presentation: 'card',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="document-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="document-scan" options={{ presentation: 'modal' }} />
                <Stack.Screen name="trip-files" options={{ presentation: 'modal' }} />
                <Stack.Screen name="contract-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="vessel-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="sea-time-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="profile-form" options={{ presentation: 'modal' }} />
              </Stack>
            </SafeAreaView>
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
