import { useCallback, useMemo, useState } from 'react';
import { I18nManager, useWindowDimensions, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { FloatingTabBar } from '@/components/floating-tab-bar';
import { STRIP_SPRING, TabStripProvider } from '@/components/tab-strip';

/** Route order of the five tabs (must match the Tabs.Screen order below). */
const TAB_PATHS = ['/', '/documents', '/contracts', '/career', '/more'] as const;
const TAB_COUNT = TAB_PATHS.length;
/** Horizontal drag, as a fraction of a page, before a release switches tabs. */
const COMMIT_DISTANCE = 0.3;
/** A flick faster than this (px/s) also switches tabs, on a short drag. */
const COMMIT_VELOCITY = 400;
/** Movement window: a gesture that leaves this box before activating is not a swipe. */
const AXIS_SLOP = 16;
/** Rubber-band factor for drags past the first/last tab. */
const OVERSCROLL = 0.35;
/** Wait for the strip glide to finish before resetting the left tab's scroll. */
const SCROLL_RESET_DELAY = 500;

function tabIndexFromPath(pathname: string): number {
  const path = pathname === '/index' ? '/' : pathname;
  const index = TAB_PATHS.indexOf(path as (typeof TAB_PATHS)[number]);
  return index < 0 ? 0 : index;
}

/** Physical left-to-right slot of a tab; RTL mirrors the strip like the tab bar. */
function slotOf(index: number): number {
  return I18nManager.isRTL ? TAB_COUNT - 1 - index : index;
}

export default function TabLayout() {
  const colors = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  // Strip translation in px: at rest pageX = -slot(activeTab) * width, so the
  // active scene sits at 0 and its neighbours rest exactly one page away. The
  // active slot itself is plain state derived from the route below.
  const pageX = useSharedValue(-slotOf(tabIndexFromPath(pathname)) * width);
  const committed = useSharedValue(false);
  const startPageX = useSharedValue(0);
  const restSlot = slotOf(tabIndexFromPath(pathname));

  // Tab a swipe release is already gliding to on the UI thread. The focus
  // listener then leaves that glide alone instead of restarting it from rest.
  const swipeTarget = useSharedValue(-1);
  const lastFocused = useSharedValue(-1);
  const [scrollResets] = useState(() => new Map<number, () => void>());

  const goToTab = useCallback(
    (index: number) => {
      router.navigate(TAB_PATHS[index]);
    },
    [router]
  );

  // Glide the strip whenever the navigator focuses a tab (tab press, swipe
  // commit, deep link). A focus listener — not an effect — so the shared value
  // never appears in a hook dependency (React Compiler's immutability rule).
  const glideTo = (index: number) => {
    // Leaving a tab: once it has slid off-screen, scroll it back to the top so it
    // opens at its start next time. (Re-focusing the same tab, e.g. coming back
    // from a pushed screen, keeps its position.)
    const left = lastFocused.value;
    lastFocused.value = index;
    if (left >= 0 && left !== index) {
      const reset = scrollResets.get(left);
      if (reset) setTimeout(reset, SCROLL_RESET_DELAY);
    }
    if (swipeTarget.value === index) {
      swipeTarget.value = -1;
      return;
    }
    swipeTarget.value = -1;
    pageX.value = withSpring(-slotOf(index) * width, STRIP_SPRING);
  };

  const swipeGesture = useMemo(() => {
    const isRTL = I18nManager.isRTL;
    return Gesture.Pan()
      .activeOffsetX([-AXIS_SLOP, AXIS_SLOP])
      .failOffsetY([-AXIS_SLOP, AXIS_SLOP])
      .onStart(() => {
        committed.value = false;
        cancelAnimation(pageX);
        startPageX.value = pageX.value;
      })
      .onUpdate((e) => {
        // The strip tracks the finger 1:1, with a rubber band past both ends.
        let slot = -(startPageX.value + e.translationX) / width;
        if (slot < 0) slot *= OVERSCROLL;
        else if (slot > TAB_COUNT - 1) slot = TAB_COUNT - 1 + (slot - (TAB_COUNT - 1)) * OVERSCROLL;
        pageX.value = -slot * width;
      })
      .onEnd((e) => {
        const slot = -pageX.value / width;
        const moved = slot - restSlot;
        const flick = Math.abs(e.velocityX) > COMMIT_VELOCITY && Math.abs(moved) > 0.05;
        let target: number;
        if (Math.abs(moved) >= 0.5) target = Math.round(slot);
        else if (Math.abs(moved) > COMMIT_DISTANCE || flick) {
          target = restSlot + (moved > 0 ? 1 : -1);
        } else {
          target = restSlot;
        }
        target = Math.min(Math.max(target, 0), TAB_COUNT - 1);
        if (target === restSlot) return;
        committed.value = true;
        // Start the glide right here on the UI thread, carrying the finger's
        // velocity — waiting for the JS navigation first caused a visible pause.
        pageX.value = withSpring(-target * width, { ...STRIP_SPRING, velocity: e.velocityX });
        const tabIndex = isRTL ? TAB_COUNT - 1 - target : target;
        swipeTarget.value = tabIndex;
        runOnJS(goToTab)(tabIndex);
      })
      .onFinalize((e) => {
        if (committed.value) return;
        // Cancelled or released short of the commit distance: glide back.
        pageX.value = withSpring(-restSlot * width, { ...STRIP_SPRING, velocity: e.velocityX });
      });
    // Shared values are stable identities (like refs); including them as deps
    // would trip React Compiler's immutability rule (mutating hook dependencies).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, restSlot, goToTab]);

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={{ flex: 1, backgroundColor: colors.background }} collapsable={false}>
        <TabStripProvider pageX={pageX} tabCount={TAB_COUNT} scrollResets={scrollResets}>
          <Tabs
            screenOptions={{
              headerShown: false,
              // Every scene stays mounted so a drag always has a page to reveal.
              lazy: false,
              // The scene wrapper must not paint over the page being dragged in;
              // each scene's own root view carries the background instead.
              sceneStyle: { backgroundColor: 'transparent' },
            }}
            tabBar={(props) => <FloatingTabBar {...props} pageX={pageX} />}
          >
            <Tabs.Screen
              name="index"
              listeners={{ focus: () => glideTo(0) }}
              options={{
                title: t('tabs.home'),
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="documents"
              listeners={{ focus: () => glideTo(1) }}
              options={{
                title: t('tabs.documents'),
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="contracts"
              listeners={{ focus: () => glideTo(2) }}
              options={{
                title: t('tabs.contracts'),
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'boat' : 'boat-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="career"
              listeners={{ focus: () => glideTo(3) }}
              options={{
                title: t('tabs.career'),
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="more"
              listeners={{ focus: () => glideTo(4) }}
              options={{
                title: t('tabs.more'),
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
                ),
              }}
            />
          </Tabs>
        </TabStripProvider>
      </View>
    </GestureDetector>
  );
}
