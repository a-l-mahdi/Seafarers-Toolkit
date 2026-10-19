import type { ReactNode } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
// Gesture-handler's Pressable takes part in native touch arbitration, so the
// gesture-handler scroll views the header floats over (forms) can never take a
// tap on a header button from it.
import { Pressable } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { FLOATING_SHADOW, floatingSurface } from '@/components/floating-tab-bar';

export type HeaderAction = {
  /** Ionicons glyph drawn inside the circle. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom content instead of an Ionicons glyph. */
  content?: ReactNode;
  onPress: () => void;
  /** Press/accessibility label (also the React key unless `id` is given). */
  label: string;
  /** Stable React key, for an action whose label changes with its state. */
  id?: string;
  color?: string;
  /** Solid brand circle (e.g. a confirm action) instead of the glass one. */
  filled?: boolean;
};

/** Height of the floating bar itself (circles + vertical padding), status bar excluded. */
export const FLOATING_HEADER_HEIGHT = Spacing.sm + 40 + Spacing.sm;

/** Top padding a screen's content needs to start clear of the floating header
 *  (same idea as useFloatingTabBarPadding for the bottom bar). */
export function useFloatingHeaderPadding(extra: number = Spacing.md): number {
  const insets = useSafeAreaInsets();
  return insets.top + FLOATING_HEADER_HEIGHT + extra;
}

/** Telegram-style FLOATING top bar: a circular back button at the start,
 *  circular icon actions at the end, and an optional oval title pill centred
 *  between them. It hovers over the page with no background — content is
 *  visible around and scrolls underneath it, exactly like the floating bottom
 *  tab bar (screens reserve top space via useFloatingHeaderPadding). Side order
 *  and the back-arrow direction follow the active layout direction (RTL mirrored). */
export function TelegramHeader({
  title,
  onBack,
  leading,
  actions,
}: {
  title?: string | null;
  onBack?: () => void;
  /** A circular action at the start side (where the back button goes) when there is no back button. */
  leading?: HeaderAction;
  actions?: HeaderAction[];
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const backIcon: keyof typeof Ionicons.glyphMap = I18nManager.isRTL ? 'arrow-forward' : 'arrow-back';
  // Exactly the floating tab bar's glass surface.
  const chipBg = floatingSurface(colors.surface);

  const renderAction = (a: HeaderAction) => (
    <Pressable
      key={a.id ?? a.label}
      onPress={a.onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a.label}
      style={({ pressed }) => [
        styles.circle,
        { backgroundColor: a.filled ? colors.primary : chipBg, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {a.content ?? (a.icon ? <Ionicons name={a.icon} size={20} color={a.color ?? colors.primary} /> : null)}
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top + Spacing.sm }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.circle, { backgroundColor: chipBg, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name={backIcon} size={22} color={colors.text} />
        </Pressable>
      ) : leading ? (
        renderAction(leading)
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.titleWrap}>
        {title ? (
          <View style={[styles.pill, { backgroundColor: chipBg }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {(actions ?? []).map(renderAction)}
        {/* Empty slot (no chip, no shadow) keeps the title pill centred when there is no end action. */}
        {(actions ?? []).length === 0 ? <View style={styles.spacer} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    // Gap between circles and pill = circles' distance from the screen edge,
    // so the pill runs almost up to the circles on both sides.
    gap: Spacing.md,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...FLOATING_SHADOW,
  },
  spacer: { width: 40, height: 40 },
  titleWrap: { flex: 1 },
  pill: {
    height: 40,
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...FLOATING_SHADOW,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
