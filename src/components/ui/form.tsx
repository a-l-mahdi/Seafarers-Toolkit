import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Lets form inputs ask the surrounding scroll view to scroll them just above
 * the keyboard when focused (works on Android edge-to-edge and iOS alike).
 */
const ScrollToInputContext = createContext<{
  scrollToInput: (inputRef: RefObject<TextInput | null>) => void;
} | null>(null);

export function FormScrollView({
  children,
  contentContainerStyle,
  ...rest
}: Omit<ComponentProps<typeof ScrollView>, 'children' | 'contentContainerStyle'> & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToInput = (inputRef: RefObject<TextInput | null>) => {
    const scrollView = scrollRef.current;
    const input = inputRef.current;
    if (!scrollView || !input) return;
    input.measureLayout(
      scrollView as unknown as View,
      (_x, y, _w, h) => {
        // Place the input ~110px from the top of the visible area so it sits
        // right above the keyboard (KeyboardAvoidingView shrinks the bottom).
        scrollView.scrollTo({ y: Math.max(y - 110, 0), animated: true });
        void h;
      },
      () => undefined
    );
  };

  return (
    <ScrollToInputContext.Provider value={{ scrollToInput }}>
      <ScrollView showsVerticalScrollIndicator={false} ref={scrollRef} {...rest} contentContainerStyle={contentContainerStyle}>
        {children}
      </ScrollView>
    </ScrollToInputContext.Provider>
  );
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  secureTextEntry?: boolean;
  error?: string | null;
}) {
  const colors = useTheme();
  const inputRef = useRef<TextInput>(null);
  const scrollHelper = useContext(ScrollToInputContext);
  const isPassword = !!secureTextEntry;
  const [reveal, setReveal] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.inputInner, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={isPassword && !reveal}
          autoCapitalize="none"
          // Never scroll inside the field: this releases the touch to the parent
          // ScrollView, so a drag that starts on an input still scrolls the page.
          scrollEnabled={false}
          onFocus={() => scrollHelper?.scrollToInput(inputRef)}
        />
        {isPassword ? (
          <Pressable onPress={() => setReveal((r) => !r)} hitSlop={8} style={styles.eyeBtn}>
            <Ionicons
              name={reveal ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export interface Option {
  id: string;
  label: string;
}

export function Select({
  label,
  value,
  options,
  onSelect,
  placeholder,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, styles.selectTrigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={{ color: selected ? colors.text : colors.textMuted }}>
          {selected?.label ?? placeholder ?? '—'}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: '#00000080' }]} onPress={() => setOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <FlatList showsVerticalScrollIndicator={false} nestedScrollEnabled
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{item.label}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.option} onPress={() => setOpen(false)}>
              <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '600' }}>✕</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Checkbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (checked: boolean) => void;
}) {
  const colors = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.checkbox} hitSlop={4}>
      <View
        style={[
          styles.checkboxBox,
          {
            borderColor: value ? colors.primary : colors.border,
            backgroundColor: value ? colors.primary : colors.surface,
          },
        ]}
      >
        {value ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function HeaderBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: Spacing.md + insets.top }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={[styles.back, { color: colors.primary }]}>‹</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: Spacing.md },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  inputWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  inputInner: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  eyeBtn: { paddingLeft: Spacing.sm, paddingVertical: Spacing.sm },
  selectTrigger: { justifyContent: 'center', minHeight: 44 },
  error: { fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '70%',
    paddingBottom: Spacing.xl,
  },
  option: { padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  back: { fontSize: 28, fontWeight: '600', width: 24 },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.sm },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
