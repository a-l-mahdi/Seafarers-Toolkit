import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Svg, { Line, Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  scrollTo,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { DocTypeIcon } from '@/components/doc-icon';
import { resolveDocIcon } from '@/domain/document-icons';
import { movePosition, type DocumentSortMode } from '@/domain/document-sort';
import { useTheme } from '@/hooks/use-theme';
import type { DocumentListRow } from '@/hooks/queries';
import { Radius, Spacing } from '@/constants/theme';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const ICON_SPRING = { damping: 14, stiffness: 220 };

/** Bar lengths (top → bottom) per state: equal rows, long → short, short → long. */
const BARS: Record<DocumentSortMode, [number, number, number]> = {
  manual: [10, 10, 10],
  daysDesc: [12, 8.5, 5],
  daysAsc: [5, 8.5, 12],
};

function Bar({ y, length, color }: { y: number; length: number; color: string }) {
  const x2 = useSharedValue(3 + length);
  useEffect(() => {
    x2.set(withSpring(3 + length, ICON_SPRING));
  }, [length, x2]);
  const props = useAnimatedProps(() => ({ x2: x2.value }));
  return (
    <AnimatedLine x1={3} y1={y} y2={y} animatedProps={props} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  );
}

function Head({ d, shown, color }: { d: string; shown: boolean; color: string }) {
  const o = useSharedValue(shown ? 1 : 0);
  useEffect(() => {
    o.set(withTiming(shown ? 1 : 0, { duration: 180 }));
  }, [shown, o]);
  const props = useAnimatedProps(() => ({ strokeOpacity: o.value }));
  return (
    <AnimatedPath
      d={d}
      animatedProps={props}
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/**
 * The documents sort button's glyph. The rows morph between the states (equal rows
 * with a two-way arrow to arrange; long → short / short → long with one arrow when
 * sorted by days left) and become a tick while arranging.
 */
export function SortIcon({ state, color }: { state: DocumentSortMode | 'arrange'; color: string }) {
  if (state === 'arrange') {
    return (
      <Animated.View key="tick" entering={ZoomIn.springify().damping(12)}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#FFFFFF"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    );
  }
  const bars = BARS[state];
  return (
    <Animated.View key="bars" entering={ZoomIn.springify().damping(12)}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Bar y={6} length={bars[0]} color={color} />
        <Bar y={12} length={bars[1]} color={color} />
        <Bar y={18} length={bars[2]} color={color} />
        <Line x1={19.5} y1={4.5} x2={19.5} y2={19.5} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Head d="M16.5 7.5l3-3 3 3" shown={state !== 'daysDesc'} color={color} />
        <Head d="M16.5 16.5l3 3 3-3" shown={state !== 'daysAsc'} color={color} />
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Arranging by hand
// ---------------------------------------------------------------------------

const ROW_H = 66;
const SLOT = ROW_H + Spacing.sm;
const SPRING = { damping: 22, stiffness: 280, mass: 0.8 };
/** Distance from the list's visible edges where a dragged card starts scrolling it. */
const EDGE = 56;
const MAX_SPEED = 12;

const lift = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const tick = () => void Haptics.selectionAsync();

type Shared = {
  positions: SharedValue<Record<string, number>>;
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
  scrollRef: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  count: number;
  topPad: number;
  bottomPad: number;
  contentH: number;
  onDrop: (positions: Record<string, number>) => void;
};

/** Every document as a card with a grip; drag the grip (or long-press a card) to move it. */
export function ReorderDocumentList({
  items,
  onOrderChange,
  topPad,
  bottomPad,
}: {
  items: DocumentListRow[];
  onOrderChange: (ids: string[]) => void;
  topPad: number;
  bottomPad: number;
}) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const positions = useSharedValue<Record<string, number>>(Object.fromEntries(items.map((d, i) => [d.id, i])));
  const count = items.length;
  const contentH = topPad + Math.max(count * SLOT - Spacing.sm, 0) + bottomPad;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const onDrop = useCallback(
    (pos: Record<string, number>) => onOrderChange(Object.keys(pos).sort((a, b) => pos[a] - pos[b])),
    [onOrderChange],
  );
  const shared: Shared = { positions, scrollY, viewportH, scrollRef, count, topPad, bottomPad, contentH, onDrop };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      onLayout={(e) => viewportH.set(e.nativeEvent.layout.height)}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: Spacing.lg }}
    >
      <Animated.View entering={FadeIn.duration(220)} style={{ height: Math.max(count * SLOT - Spacing.sm, 0) }}>
        {items.map((item, i) => (
          <ReorderRow key={item.id} item={item} index={i} shared={shared} />
        ))}
      </Animated.View>
    </Animated.ScrollView>
  );
}

function ReorderRow({ item, index, shared }: { item: DocumentListRow; index: number; shared: Shared }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { positions, scrollY, viewportH, scrollRef, count, topPad, bottomPad, contentH, onDrop } = shared;
  const id = item.id;
  const top = useSharedValue(index * SLOT);
  const active = useSharedValue(false);
  const startTop = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Cards that are not held glide to their new slot as the held one passes them.
  useAnimatedReaction(
    () => positions.value[id],
    (cur, prev) => {
      if (prev !== null && prev !== undefined && cur !== prev && !active.value) {
        top.set(withSpring(cur * SLOT, SPRING));
      }
    },
  );

  const follow = () => {
    'worklet';
    top.set(startTop.value + dragY.value + (scrollY.value - startScroll.value));
    const to = Math.min(Math.max(Math.round(top.value / SLOT), 0), count - 1);
    if (to !== positions.value[id]) {
      positions.set(movePosition(positions.value, id, to));
      runOnJS(tick)();
    }
  };

  // Near the top / bottom edge the held card scrolls the list along with it.
  useFrameCallback(() => {
    if (!active.value) return;
    const y = topPad + top.value - scrollY.value;
    const upper = topPad + EDGE * 0.25;
    const lower = viewportH.value - bottomPad - EDGE * 0.25;
    let speed = 0;
    if (y < upper) speed = -Math.min(((upper - y) / EDGE) * MAX_SPEED, MAX_SPEED);
    else if (y + ROW_H > lower) speed = Math.min(((y + ROW_H - lower) / EDGE) * MAX_SPEED, MAX_SPEED);
    if (speed === 0) return;
    const maxScroll = Math.max(contentH - viewportH.value, 0);
    const next = Math.min(Math.max(scrollY.value + speed, 0), maxScroll);
    if (next === scrollY.value) return;
    scrollY.set(next);
    scrollTo(scrollRef, 0, next, false);
    follow();
  });

  const begin = () => {
    'worklet';
    active.set(true);
    startTop.set(top.value);
    startScroll.set(scrollY.value);
    dragY.set(0);
    runOnJS(lift)();
  };
  const end = () => {
    'worklet';
    if (!active.value) return;
    active.set(false);
    top.set(withSpring(positions.value[id] * SLOT, SPRING));
    runOnJS(onDrop)(positions.value);
  };

  // The grip grabs at once; the rest of the card after a long press (so the list still scrolls).
  const grip = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((_e, state) => state.activate())
    .onStart(begin)
    .onUpdate((e) => {
      dragY.set(e.translationY);
      follow();
    })
    .onFinalize(end);
  const card = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(begin)
    .onUpdate((e) => {
      dragY.set(e.translationY);
      follow();
    })
    .onFinalize(end);

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: active.value ? 10 : 0,
    elevation: active.value ? 10 : 0,
    shadowOpacity: withTiming(active.value ? 0.2 : 0, { duration: 150 }),
    borderColor: active.value ? colors.primary : colors.border,
    borderWidth: active.value ? 1.5 : StyleSheet.hairlineWidth,
    transform: [{ scale: withSpring(active.value ? 1.03 : 1, SPRING) }],
  }));

  const days = item.daysUntilExpiry;
  return (
    <GestureDetector gesture={card}>
      <Animated.View style={[styles.row, { backgroundColor: colors.surface, shadowColor: colors.primary }, style]}>
        <DocTypeIcon value={resolveDocIcon(item.typeId, item.typeIcon, item.typeColor)} size={40} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {days !== null ? `${Math.max(days, 0)} ${t('documents.daysLeft')}` : t('documents.noExpiry')}
          </Text>
        </View>
        <GestureDetector gesture={grip}>
          <View style={[styles.grip, { backgroundColor: colors.primaryMuted }]} hitSlop={6}>
            <Ionicons name="reorder-three" size={24} color={colors.primary} />
          </View>
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    paddingStart: Spacing.md,
    paddingEnd: Spacing.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5 },
  grip: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
