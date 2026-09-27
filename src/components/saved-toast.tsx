import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';
import { Text } from '@/components/ui/text';
import { FLOATING_HEADER_HEIGHT } from '@/components/telegram-header';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const SHOW_MS = 1600;

const useToastStore = create<{ nonce: number | null }>(() => ({ nonce: null }));

/** Flashes a short "Saved" toast; it lives at the root, so it survives leaving the screen. */
export function showSavedToast() {
  useToastStore.setState({ nonce: Date.now() });
}

/** Rendered once at the root, over every screen. */
export function SavedToastHost() {
  const nonce = useToastStore((s) => s.nonce);
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (nonce === null) return;
    const timer = setTimeout(() => useToastStore.setState({ nonce: null }), SHOW_MS);
    return () => clearTimeout(timer);
  }, [nonce]);

  if (nonce === null) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + FLOATING_HEADER_HEIGHT + Spacing.sm }]}>
      <Animated.View
        key={nonce}
        entering={ZoomIn.springify().damping(14)}
        exiting={FadeOutUp.duration(220)}
        style={[styles.pill, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
      >
        <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
        <Text style={[styles.text, { color: colors.onPrimary }]}>{t('common.saved')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, elevation: 100 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  text: { fontSize: 14, fontWeight: '700' },
});
