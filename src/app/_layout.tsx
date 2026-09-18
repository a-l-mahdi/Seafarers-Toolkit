import { useEffect, useMemo, useRef, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Animated, I18nManager, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Updates from 'expo-updates';
import i18n, { isRTL } from '@/i18n';
import { openDatabase } from '@/database/db';
import { initNotifications, syncNotifications } from '@/services/notification-service';
import { useSettingsStore } from '@/store/settings-store';
import { listDocuments } from '@/database/repositories/documents-repository';

const SPLASH_BLUE = '#0156C9';

SplashScreen.preventAutoHideAsync();
I18nManager.allowRTL(true);

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const scheme = useColorScheme();
  const { locale, theme, hydrated, hydrate } = useSettingsStore();
  const [dbReady, setDbReady] = useState(false);
  const router = useRouter();
  const [pendingAlert, setPendingAlert] = useState<{ docId: string; nonce: number } | null>(null);
  const handledResponses = useRef<Set<string>>(new Set());
  const navigatedNonce = useRef<number | null>(null);

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
    })();
  }, [hydrate]);

  // Tapping a document notification opens that document's alert page. Handles
  // both a warm tap (listener) and a cold launch from a killed state (last response).
  useEffect(() => {
    const takeResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const requestId = response.notification.request.identifier;
      if (handledResponses.current.has(requestId)) return;
      const docId = response.notification.request.content.data?.documentId;
      if (typeof docId !== 'string' || !docId) return;
      handledResponses.current.add(requestId);
      setPendingAlert({ docId, nonce: Date.now() });
    };

    const sub = Notifications.addNotificationResponseReceivedListener(takeResponse);
    Notifications.getLastNotificationResponseAsync().then(takeResponse).catch(() => undefined);
    return () => sub.remove();
  }, []);

  // Navigate once the router (Stack) is mounted. A ref guards against re-navigating
  // for the same tap without needing to clear state inside the effect.
  useEffect(() => {
    if (hydrated && dbReady && pendingAlert && navigatedNonce.current !== pendingAlert.nonce) {
      navigatedNonce.current = pendingAlert.nonce;
      router.push({ pathname: '/document-alert', params: { id: pendingAlert.docId } });
    }
  }, [hydrated, dbReady, pendingAlert, router]);

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

  // Full-screen branded splash: Android 12+ only allows a centred icon for the
  // system splash, so once the app tree (with the splash image on top) is mounted
  // we hide the native splash, hold the image briefly, then fade it out.
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (hydrated && dbReady) {
      SplashScreen.hideAsync().catch(() => undefined);
      const timer = setTimeout(() => {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setSplashHidden(true));
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [hydrated, dbReady, splashOpacity]);

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
            <View
              style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}
            >
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
            </View>
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
      {!splashHidden ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.splash, { opacity: splashOpacity }]}
        >
          <Image
            source={require('../../assets/images/splash-full.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: SPLASH_BLUE },
});
