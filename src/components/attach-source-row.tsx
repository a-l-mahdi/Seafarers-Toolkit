import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export type AttachSource = 'camera' | 'gallery' | 'file';

/**
 * Commercial-style attach picker: three equal cards in a single row
 * (Camera / Gallery / File), each an icon above a short label.
 */
export function AttachSourceRow({
  onPick,
  disabled,
}: {
  onPick: (source: AttachSource) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useTheme();

  const items: { key: AttachSource; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'camera', icon: 'camera-outline', label: t('common.camera') },
    { key: 'gallery', icon: 'image-outline', label: t('common.gallery') },
    { key: 'file', icon: 'document-text-outline', label: t('common.file') },
  ];

  return (
    <View style={styles.row}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={() => onPick(it.key)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            pressed && { opacity: 0.7 },
            disabled && { opacity: 0.5 },
          ]}
        >
          <Ionicons name={it.icon} size={24} color={colors.primary} />
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
