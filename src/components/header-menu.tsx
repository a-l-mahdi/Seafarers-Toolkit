import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { FLOATING_HEADER_HEIGHT } from '@/components/telegram-header';

export type HeaderMenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/** Dropdown opened from a header "⋮" button, anchored under the header's action side. */
export function HeaderMenu({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: HeaderMenuItem[];
  onClose: () => void;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View
          style={[
            styles.menu,
            { top: insets.top + FLOATING_HEADER_HEIGHT, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {items.map((item, i) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              android_ripple={{ color: colors.primaryMuted }}
              style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <Ionicons name={item.icon} size={20} color={colors.primary} />
              <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    end: Spacing.md,
    minWidth: 190,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14, paddingHorizontal: Spacing.lg },
  label: { fontSize: 15, fontWeight: '500' },
});
