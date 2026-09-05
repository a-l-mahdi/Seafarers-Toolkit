import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const [state, setState] = useState<PickerState | null>(() => {
    if (isISODate(initialIso)) {
      if (isJalali) {
        const j = gregorianToJalali(initialIso).split('/');
        return { year: +j[0], month: +j[1], day: +j[2] };
      }
      const [y, m, d] = initialIso.split('-').map(Number);
      return { year: y, month: m, day: d };
    }
    const today = todayISO();
    if (isJalali) {
      const j = gregorianToJalali(today).split('/');
      return { year: +j[0], month: +j[1], day: +j[2] };
    }
    const [y, m, d] = today.split('-').map(Number);
    return { year: y, month: m, day: d };
  });

  if (!state) return null;

  const years: number[] = [];
  const startYear = state.year - 30;
  for (let y = startYear; y < startYear + 80; y += 1) years.push(y);
  const months = isJalali
    ? JALALI_MONTHS.map((name, i) => ({ value: i + 1, label: name }))
    : GREGORIAN_MONTHS.map((name, i) => ({ value: i + 1, label: name }));
  const maxDay = isJalali
    ? jalaliDaysInMonth(state.year, state.month)
    : daysInMonth(state.year, state.month);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const confirm = () => {
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
            {t('settings.calendarType')}: {isJalali ? t('settings.jalali') : t('settings.gregorian')}
          </Text>
          <View style={styles.row}>
            <WheelColumn label={isJalali ? t('common.year') : 'Year'} options={years.map((y) => ({ value: y, label: String(y) }))} selected={state.year} onSelect={(year) => setState({ ...state, year })} />
            <WheelColumn label={isJalali ? t('common.month') : 'Month'} options={months} selected={state.month} onSelect={(month) => setState({ ...state, month, day: Math.min(state.day, isJalali ? jalaliDaysInMonth(state.year, month) : daysInMonth(state.year, month)) })} />
            <WheelColumn label={isJalali ? t('common.dayOfMonth') : 'Day'} options={days.map((d) => ({ value: d, label: String(d) }))} selected={state.day} onSelect={(day) => setState({ ...state, day })} />
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClear} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={() => { const today = todayISO(); onConfirm(today); }} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
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
  return (
    <View style={styles.column}>
      <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.wheel, { borderColor: colors.border }]}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={[styles.wheelItem, o.value === selected && { backgroundColor: colors.primaryMuted, borderRadius: Radius.sm }]}
          >
            <Text style={{ color: o.value === selected ? colors.primary : colors.text, fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        ))}
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
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
  column: { alignItems: 'center', flex: 1 },
  pickerLabel: { fontSize: 12, marginBottom: 4 },
  wheel: { borderWidth: 1, borderRadius: Radius.md, maxHeight: 200 },
  wheelItem: { paddingHorizontal: Spacing.md, paddingVertical: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center' },
});
