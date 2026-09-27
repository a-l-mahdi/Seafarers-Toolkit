import { useEffect, useMemo, useRef, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Appearance, I18nManager, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Updates from 'expo-updates';
import i18n, { isRTL } from '@/i18n';
import { openDatabase } from '@/database/db';
import { initNotifications, resyncNotifications } from '@/services/notification-service';
import { markDeliveredByKey, markReadByKey } from '@/database/repositories/notifications-repository';
import { useSettingsStore } from '@/store/settings-store';
import { SavedToastHost } from '@/components/saved-toast';

/** The stored key of a trip / note reminder carried in its notification data. */
function reminderKey(data: Record<string, unknown> | undefined) {
  if (!data || typeof data.notificationType !== 'string') return null;
  if (typeof data.noteId === 'string') return { eventType: 'note', eventId: data.noteId, type: data.notificationType };
  if (typeof data.contractId === 'string') {
    return { eventType: 'contract', eventId: data.contractId, type: data.notificationType };
  }
  return null;
}

/** Records a trip / note reminder as delivered (read when its banner was tapped)
 *  so it is listed in the notification centre. */
async function deliverReminder(data: Record<string, unknown> | undefined, read = false): Promise<void> {
  const key = reminderKey(data);
  if (!key) return;
  try {
    if (read) await markReadByKey(key.eventType, key.eventId, key.type);
    else await markDeliveredByKey(key.eventType, key.eventId, key.type);
  } catch {
    // best-effort
  }
}

SplashScreen.preventAutoHideAsync();
I18nManager.allowRTL(true);
// Tab scenes must stay mounted and visible instead of being detached/hidden
// natively, so the drag pager can show the neighbouring page under the finger.
// (The root stack keeps react-native-screens — it passes `enabled` explicitly.)
enableScreens(false);

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Reuse cached data across screen navigations instead of re-querying the DB
        // on every mount (which made opening screens feel laggy). Mutations still
        // invalidate the relevant queries, so edits stay fresh.
        defaultOptions: {
          queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  const scheme = useColorScheme();
  const { locale, theme, hydrated, hydrate } = useSettingsStore();
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const [pendingAlert, setPendingAlert] = useState<{
    pathname: '/document-alert' | '/notifications' | '/calendar';
    params?: Record<string, string>;
    nonce: number;
  } | null>(null);
  const handledResponses = useRef<Set<string>>(new Set());
  const navigatedNonce = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      await hydrate();
      await openDatabase();
      setDbReady(true);
      await initNotifications();
      // Shares the one-at-a-time resync, so it never overlaps a save's reschedule.
      void resyncNotifications().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
    })();
  }, [hydrate, queryClient]);

  // Tapping a document notification opens that document's alert page. Handles
  // both a warm tap (listener) and a cold launch from a killed state (last response).
  useEffect(() => {
    const takeResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const requestId = response.notification.request.identifier;
      if (handledResponses.current.has(requestId)) return;
      const data = response.notification.request.content.data;
      // A note reminder opens the calendar on that note.
      if (typeof data?.noteId === 'string' && data.noteId) {
        handledResponses.current.add(requestId);
        void deliverReminder(data, true).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
        setPendingAlert({ pathname: '/calendar', params: { note: data.noteId }, nonce: Date.now() });
        return;
      }
      // Trip reminders open the notification centre; the reminder there leads on
      // to the trip and its checklist.
      if (typeof data?.contractId === 'string' && data.contractId) {
        handledResponses.current.add(requestId);
        void deliverReminder(data).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
        setPendingAlert({ pathname: '/notifications', nonce: Date.now() });
        return;
      }
      const docId = data?.documentId;
      if (typeof docId !== 'string' || !docId) return;
      handledResponses.current.add(requestId);
      setPendingAlert({ pathname: '/document-alert', params: { id: docId }, nonce: Date.now() });
    };

    // A trip / note reminder firing while the app is open shows up in the centre at once.
    const received = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data;
      if (!reminderKey(data)) return;
      void deliverReminder(data).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
    });

    const sub = Notifications.addNotificationResponseReceivedListener(takeResponse);
    Notifications.getLastNotificationResponseAsync()
      .then(takeResponse)
      .catch(() => undefined);
    return () => {
      sub.remove();
      received.remove();
    };
  }, [queryClient]);

  // Navigate once the router (Stack) is mounted. A ref guards against re-navigating
  // for the same tap without needing to clear state inside the effect.
  useEffect(() => {
    if (hydrated && dbReady && pendingAlert && navigatedNonce.current !== pendingAlert.nonce) {
      navigatedNonce.current = pendingAlert.nonce;
      router.push({ pathname: pendingAlert.pathname, params: pendingAlert.params ?? {} });
    }
  }, [hydrated, dbReady, pendingAlert, router]);

  // Native UI (date pickers, alerts, keyboard) follows the theme chosen in Settings.
  useEffect(() => {
    if (hydrated) Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [hydrated, theme]);

  useEffect(() => {
    if (hydrated) {
      void i18n.changeLanguage(locale);
      // Match the native layout direction to the locale. When it differs (e.g. a
      // fresh Farsi install on an LTR device) forcing RTL only takes full effect
      // after a reload, so reload once — the direction then matches and it won't
      // fire again.
      if (isRTL(locale) !== I18nManager.isRTL) {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(isRTL(locale));
        void Updates.reloadAsync();
      }
    }
  }, [hydrated, locale]);

  // The launch window already shows the branded splash image (see MainActivity /
  // AppTheme.Launch) until the app tree draws over it; no second copy in JS.
  useEffect(() => {
    if (hydrated && dbReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated, dbReady]);

  const navigationTheme = useMemo(() => {
    const preferDark = scheme === 'dark';
    const base = preferDark ? DarkTheme : DefaultTheme;
    const colors = preferDark ? Colors.dark : Colors.light;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        primary: colors.primary,
        text: colors.text,
      },
    };
  }, [scheme]);

  if (!hydrated || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <SafeAreaProvider>
            <View style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  presentation: 'card',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="document-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="trip-files" options={{ presentation: 'modal' }} />
                <Stack.Screen name="contract-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="vessel-form" options={{ presentation: 'modal' }} />
                <Stack.Screen name="profile-form" options={{ presentation: 'modal' }} />
              </Stack>
              <SavedToastHost />
            </View>
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
      {/* Status-bar icons follow the app theme (not the device theme). */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </GestureHandlerRootView>
  );
}
