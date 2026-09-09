import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const background =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surface;
  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...card, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={card}>{children}</View>;
}

export function Badge({
  label,
  tone = 'info',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'muted';
}) {
  const colors = useTheme();
  const map = {
    success: [colors.successMuted, colors.success],
    warning: [colors.warningMuted, colors.warning],
    danger: [colors.dangerMuted, colors.danger],
    info: [colors.infoMuted, colors.info],
    muted: [colors.surfaceMuted, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  tone,
  color,
}: {
  progress: number;
  tone?: 'success' | 'primary' | 'warning' | 'danger';
  color?: string;
}) {
  const colors = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const toneColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : colors.primary;
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: color ?? toneColor,
          },
        ]}
      />
    </View>
  );
}

export function EmptyState({ title }: { title: string }) {
  const colors = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
}

export function FieldRow({ label, value }: { label: string; value?: string | null }) {
  const colors = useTheme();
  return (
    <View style={styles.fieldRow}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  track: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.full },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 6,
  },
  fieldLabel: { fontSize: 14 },
  fieldValue: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
});
