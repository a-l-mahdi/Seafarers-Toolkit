import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DOC_COLOR_CHOICES, DOC_ICON_CHOICES, type DocIcon } from '@/domain/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

type GlyphName = keyof typeof MaterialCommunityIcons.glyphMap;

/** A document-type icon on a soft tile of its own colour. */
export function DocTypeIcon({
  value,
  size = 44,
  solid,
}: {
  value: DocIcon;
  size?: number;
  /** Filled tile with a white glyph (for coloured headers). */
  solid?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? value.color : `${value.color}1F`,
      }}
    >
      <MaterialCommunityIcons
        name={value.icon as GlyphName}
        size={size * 0.56}
        color={solid ? '#FFFFFF' : value.color}
      />
    </View>
  );
}

/** Icon grid and colour swatches for choosing a document-type icon. */
export function DocIconPicker({ value, onChange }: { value: DocIcon; onChange: (next: DocIcon) => void }) {
  const colors = useTheme();
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.swatches}>
        {DOC_COLOR_CHOICES.map((c) => {
          const on = c.toLowerCase() === value.color.toLowerCase();
          return (
            <Pressable
              key={c}
              onPress={() => onChange({ ...value, color: c })}
              hitSlop={4}
              style={[styles.swatchRing, { borderColor: on ? c : 'transparent' }]}
            >
              <View style={[styles.swatch, { backgroundColor: c }]}>
                {on ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.grid}>
        {DOC_ICON_CHOICES.map((name) => {
          const on = name === value.icon;
          return (
            <Pressable
              key={name}
              onPress={() => onChange({ ...value, icon: name })}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: on ? `${value.color}24` : colors.surfaceMuted,
                  borderColor: on ? value.color : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons name={name as GlyphName} size={24} color={on ? value.color : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  swatchRing: { borderWidth: 2, borderRadius: Radius.full, padding: 2 },
  swatch: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  cell: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
