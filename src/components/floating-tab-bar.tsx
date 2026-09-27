import { useEffect, useMemo, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useTheme } from '@/hooks/use-theme';

/** Height of the floating bar itself (excludes the safe-area gap below it). */
export const TAB_BAR_HEIGHT = 76;
const SIDE_MARGIN = 16;
const BOTTOM_MARGIN = 12;
const BAR_RADIUS = 30;
const PILL_HEIGHT = 56;
const PILL_RADIUS = 22;
const ITEM_GAP = 3;
/** Extra air so the last list item can scroll clear of the floating bar. */
const CLEARANCE = 24;
/** Near-opaque alpha appended to the surface color (#RRGGBB + alpha). */
const SURFACE_ALPHA = 'F2';

/** Glass surface shared by every floating chrome element (tab bar + header chips). */
export function floatingSurface(surface: string): string {
  return `${surface}${SURFACE_ALPHA}`;
}

/** Drop shadow shared by every floating chrome element (tab bar + header chips). */
export const FLOATING_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 10,
} as const;

/**
 * Bottom padding for scrollable tab-screen content: floating bar height +
 * system-navigation inset + gap below the bar + clearance above it. Keeps the
 * last item from hiding behind the bar while content still scrolls under it.
 */
export function useFloatingTabBarPadding(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + BOTTOM_MARGIN + CLEARANCE;
}

type TabFrame = { x: number; width: number };

type FloatingTabBarProps = BottomTabBarProps & {
  /** Tab-strip translation shared with the tab layout (px). */
  pageX: SharedValue<number>;
};

/**
 * Telegram-style floating bottom navigation: a rounded pill bar floating above
 * the edge-to-edge content with a highlight that slides between tabs, driven by
 * the same strip value as the pages so both always move together.
 */
export function FloatingTabBar({ state, descriptors, navigation, insets, pageX }: FloatingTabBarProps) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [frames, setFrames] = useState<Record<string, TabFrame>>({});
  const slotX = useSharedValue<number[]>([]);
  const slotWidth = useSharedValue<number[]>([]);
  const tabCount = state.routes.length;

  // RN rewrites style `left`/`right` into logical start/end when the app is
  // RTL (`doLeftAndRightSwapInRTL`, on by default). Anchoring the pill with
  // `left` would therefore anchor it to the physical RIGHT edge in RTL and
  // mirror the highlight (tab layout.x stays physical). `right: 0` is swapped
  // to `end`, which Yoga resolves back to the physical LEFT edge in RTL — so
  // `translateX = activeTab.x` holds in both directions and LTR is untouched.
  const pillAnchor = I18nManager.isRTL ? styles.pillAnchorRight : styles.pillAnchorLeft;

  // Frames ordered by physical slot (RTL mirrors the bar) for the pill worklet.
  const slots = useMemo(() => {
    const xs = new Array<number>(tabCount).fill(0);
    const widths = new Array<number>(tabCount).fill(0);
    state.routes.forEach((route, index) => {
      const frame = frames[route.key];
      if (!frame) return;
      const slot = I18nManager.isRTL ? tabCount - 1 - index : index;
      xs[slot] = frame.x;
      widths[slot] = frame.width;
    });
    return { xs, widths };
  }, [frames, state.routes, tabCount]);

  useEffect(() => {
    slotX.value = slots.xs;
    slotWidth.value = slots.widths;
  }, [slots, slotX, slotWidth]);

  // Position AND width follow the strip frame by frame: a finger drag, a
  // tab-bar tap and the settling spring all read as one continuous motion.
  const pillStyle = useAnimatedStyle(() => {
    const xs = slotX.value;
    const ws = slotWidth.value;
    if (ws.length !== tabCount) {
      return { width: 0, transform: [{ translateX: 0 }] };
    }
    for (let i = 0; i < ws.length; i += 1) {
      if (ws[i] <= 0) {
        return { width: 0, transform: [{ translateX: 0 }] };
      }
    }
    const slot = Math.min(Math.max(-pageX.value / width, 0), tabCount - 1);
    const from = Math.floor(slot);
    const to = Math.min(from + 1, tabCount - 1);
    const fraction = slot - from;
    return {
      transform: [{ translateX: xs[from] + (xs[to] - xs[from]) * fraction }],
      width: ws[from] + (ws[to] - ws[from]) * fraction,
    };
  });

  const recordFrame = (key: string, x: number, width: number) => {
    setFrames((prev) => {
      const existing = prev[key];
      if (existing && existing.x === x && existing.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  };

  const handlePress = (route: (typeof state.routes)[number], isFocused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          bottom: insets.bottom + BOTTOM_MARGIN,
          // Semi-transparent surface instead of blur — no extra Android deps.
          backgroundColor: floatingSurface(colors.surface),
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, pillAnchor, { backgroundColor: colors.primaryMuted }, pillStyle]}
      />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? colors.tabActive : colors.tabInactive;
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => handlePress(route, isFocused)}
            onLayout={(e) => recordFrame(route.key, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
            style={styles.item}
          >
            <View style={styles.itemInner}>
              {options.tabBarIcon ? (
                options.tabBarIcon({ focused: isFocused, color, size: 24 })
              ) : null}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.label, { color }, isFocused && styles.labelFocused]}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    ...FLOATING_SHADOW,
  },
  pill: {
    position: 'absolute',
    top: (TAB_BAR_HEIGHT - PILL_HEIGHT) / 2,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
  },
  pillAnchorLeft: {
    left: 0,
  },
  pillAnchorRight: {
    right: 0,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    gap: ITEM_GAP,
    width: '100%',
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  labelFocused: {
    fontWeight: '600',
  },
});
