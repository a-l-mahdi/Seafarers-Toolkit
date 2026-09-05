import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settings-store';
import {
  GREGORIAN_MONTHS,
  JALALI_MONTHS,
  daysInMonth,
  gregorianToJalali,
  isISODate,
  jalaliDaysInMonth,
  jalaliToGregorianExact,
  todayISO,
} from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

const ITEM_H = 40;
const VISIBLE_ITEMS = 5;

interface PickerState {
  year: number;
  month: number;
  day: number;
}

/**
 * Date field that respects the user's calendar preference (Gregorian / Jalali).
 * Opens a picker modal; the value is always stored as an ISO Gregorian date string.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const calendar = useSettingsStore((s) => s.calendar);
  const [open, setOpen] = useState(false);

  const display = useMemo(() => {
    if (!value || !isISODate(value)) return '';
    return calendar === 'jalali' ? gregorianToJalali(value) : value;
  }, [value, calendar]);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      >
        <Text style={{ color: display ? colors.text : colors.textMuted, fontSize: 15 }}>
          {display || t('common.select')}
        </Text>
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {open ? (
        <DatePickerModal
          key={`${value}-${calendar}`}
          calendar={calendar}
          initialIso={value}
          onClose={() => setOpen(false)}
          onConfirm={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
          onClear={() => {
            onChange('');
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

export function DatePickerModal({
  calendar,
  initialIso,
  onClose,
  onConfirm,
  onClear,
}: {
  calendar: 'gregorian' | 'jalali';
  initialIso: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const isJalali = calendar === 'jalali';

  const [state, setState] = useState<PickerState>(() => {
    let base = isISODate(initialIso) ? initialIso : todayISO();
    if (isJalali) {
      const j = gregorianToJalali(base).split('/');
      return { year: +j[0], month: +j[1], day: +j[2] };
    }
    const [y, m, d] = base.split('-').map(Number);
    return { year: y, month: m, day: d };
  });

  const years: { value: number; label: string }[] = [];
  const yStart = isJalali ? 1300 : 1930;
  const yEnd = isJalali ? 1500 : 2130;
  for (let y = yStart; y <= yEnd; y += 1) years.push({ value: y, label: String(y) });

  const months = useMemo(
    () =>
      isJalali
        ? JALALI_MONTHS.map((name, i) => ({ value: i + 1, label: name }))
        : GREGORIAN_MONTHS.map((name, i) => ({ value: i + 1, label: name })),
    [isJalali]
  );

  const maxDay = isJalali
    ? jalaliDaysInMonth(state.year, state.month)
    : daysInMonth(state.year, state.month);
  const days: { value: number; label: string }[] = [];
  for (let d = 1; d <= maxDay; d += 1) days.push({ value: d, label: String(d) });

  const setYear = (year: number) => setState((s) => (s ? { ...s, year } : s));
  const setMonth = (month: number) =>
    setState((s) => {
      if (!s) return s;
      const cap = isJalali ? jalaliDaysInMonth(s.year, month) : daysInMonth(s.year, month);
      return { ...s, month, day: Math.min(s.day, cap) };
    });
  const setDay = (day: number) => setState((s) => (s ? { ...s, day } : s));

  const confirm = () => {
    if (!state) return;
    const iso = isJalali
      ? jalaliToGregorianExact(state.year, state.month, state.day)
      : `${state.year}-${String(state.month).padStart(2, '0')}-${String(state.day).padStart(2, '0')}`;
    if (iso) onConfirm(iso);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isJalali ? t('settings.jalali') : t('settings.gregorian')}
          </Text>
          <View style={styles.row}>
            <WheelColumn
              label={isJalali ? t('common.year') : 'Year'}
              options={years}
              selected={state.year}
              onSelect={setYear}
            />
            <WheelColumn
              label={isJalali ? t('common.month') : 'Month'}
              options={months}
              selected={state.month}
              onSelect={setMonth}
            />
            <WheelColumn
              label={isJalali ? t('common.dayOfMonth') : 'Day'}
              options={days}
              selected={state.day}
              onSelect={setDay}
            />
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClear} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(todayISO())}
              style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={{ color: colors.primary }}>{t('common.today')}</Text>
            </Pressable>
            <Pressable onPress={confirm} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t('common.confirm')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WheelColumn({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: number; label: string }[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const colors = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(
    options.findIndex((o) => o.value === selected),
    0
  );

  // Keep the selected item centered in the wheel.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: false });
  }, [index, options.length]);

  return (
    <View style={styles.column}>
      <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.wheel, { borderColor: colors.border }]}>
        <ScrollView
          ref={scrollRef}
          style={{ height: VISIBLE_ITEMS * ITEM_H }}
          contentContainerStyle={{
            paddingVertical: ((VISIBLE_ITEMS - 1) / 2) * ITEM_H,
          }}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {options.map((o) => {
            const active = o.value === selected;
            return (
              <Pressable
                key={o.value}
                onPress={() => onSelect(o.value)}
                style={[
                  styles.wheelItem,
                  { height: ITEM_H },
                  active && { backgroundColor: colors.primaryMuted, borderRadius: Radius.sm },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.text,
                    fontSize: 15,
                    fontWeight: active ? '700' : '400',
                  }}
                  numberOfLines={1}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: Spacing.md },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  trigger: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  error: { fontSize: 12, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: Spacing.xl },
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg, overflow: 'hidden' },
  title: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
  column: { alignItems: 'center', flex: 1 },
  pickerLabel: { fontSize: 12, marginBottom: 4 },
  wheel: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden', width: '100%' },
  wheelItem: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center' },
});
