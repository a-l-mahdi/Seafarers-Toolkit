import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { useContracts, useDocuments, useLeaveSettings } from '@/hooks/queries';
import { earnedLeaveDays } from '@/domain/leave';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import {
  diffInDays,
  gregorianToJalali,
  isoToDate,
  jalaliDaysInMonth,
  jalaliToGregorianExact,
  JALALI_MONTHS,
  todayISO,
} from '@/utils/date';

type DayEvent = 'onboard' | 'leave' | 'expiry' | 'contract_start' | 'contract_end';

const pad = (n: number) => String(n).padStart(2, '0');

interface MonthView {
  /** Number of days in the displayed month (in the selected calendar). */
  days: number;
  /** Column index (0-6) of the first day of the month. */
  firstCol: number;
  title: string;
  /** Gregorian ISO date for the given day-of-month in the displayed calendar. */
  isoForDay: (day: number) => string;
  parts: { y: number; m: number };
}

function buildMonthView(anchorISO: string, calendar: 'gregorian' | 'jalali', locale: string): MonthView {
  if (calendar === 'jalali') {
    const [jy, jm] = gregorianToJalali(anchorISO).split('/').map(Number);
    const firstIso = jalaliToGregorianExact(jy, jm, 1)!;
    return {
      days: jalaliDaysInMonth(jy, jm),
      // Jalali weeks start on Saturday (getDay 6) → column 0.
      firstCol: (isoToDate(firstIso).getUTCDay() + 1) % 7,
      title: `${JALALI_MONTHS[jm - 1]} ${jy}`,
      isoForDay: (d) => jalaliToGregorianExact(jy, jm, d)!,
      parts: { y: jy, m: jm },
    };
  }
  const [y, m] = anchorISO.split('-').map(Number);
  const firstIso = `${y}-${pad(m)}-01`;
  const formatter = new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', {
    month: 'long',
    year: 'numeric',
  });
  return {
    days: new Date(y, m, 0).getDate(),
    firstCol: isoToDate(firstIso).getUTCDay(),
    title: formatter.format(isoToDate(firstIso)),
    isoForDay: (d) => `${y}-${pad(m)}-${pad(d)}`,
    parts: { y, m },
  };
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const calendarPref = useSettingsStore((s) => s.calendar);
  const locale = useSettingsStore((s) => s.locale);
  const [anchor, setAnchor] = useState(() => todayISO());
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: leaveSettings } = useLeaveSettings();

  const view = useMemo(
    () => buildMonthView(anchor, calendarPref, locale),
    [anchor, calendarPref, locale]
  );

  const events = useMemo(() => {
    const map = new Map<string, Set<DayEvent>>();
    const add = (iso: string, event: DayEvent) => {
      if (!iso) return;
      if (!map.has(iso)) map.set(iso, new Set());
      map.get(iso)!.add(event);
    };
    for (const c of contracts ?? []) {
      const end = c.actualSignOff ?? c.expectedSignOff;
      // walk contract range day by day (bounded, safe)
      let cursor = c.joinDate;
      add(cursor, 'contract_start');
      add(end, 'contract_end');
      let guard = 0;
      while (cursor < end && guard < 800) {
        add(cursor, 'onboard');
        const [y, m, d] = cursor.split('-').map(Number);
        cursor = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
        guard += 1;
      }
      // Leave earned proportionally to actual sea days, rounded up.
      if (leaveSettings && end) {
        const daysOnboard = Math.max(diffInDays(c.joinDate, end), 0);
        const leaveDays = Math.min(earnedLeaveDays(leaveSettings, daysOnboard), 400);
        let leaveCursor = end;
        let walked = 0;
        let guard2 = 0;
        while (walked < leaveDays && guard2 < 420) {
          add(leaveCursor, 'leave');
          const [y, m, d] = leaveCursor.split('-').map(Number);
          leaveCursor = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
          walked += 1;
          guard2 += 1;
        }
      }
    }
    for (const doc of documents ?? []) {
      if (doc.expiryDate) add(doc.expiryDate, 'expiry');
    }
    return map;
  }, [contracts, documents, leaveSettings]);

  const weekdayLabels = useMemo(() => {
    if (calendarPref === 'jalali') return ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const fmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', { weekday: 'narrow' });
    // 2023-01-01 was a Sunday (getUTCDay 0) → labels for columns 0..6.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
  }, [calendarPref, locale]);

  const cells: (number | null)[] = [
    ...Array.from({ length: view.firstCol }, () => null),
    ...Array.from({ length: view.days }, (_, i) => i + 1),
  ];

  const today = todayISO();

  const prev = () => {
    if (calendarPref === 'jalali') {
      const { y, m } = view.parts;
      const [ny, nm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      setAnchor(jalaliToGregorianExact(ny, nm, 1)!);
    } else {
      const { y, m } = view.parts;
      const [ny, nm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      setAnchor(`${ny}-${pad(nm)}-01`);
    }
  };
  const next = () => {
    if (calendarPref === 'jalali') {
      const { y, m } = view.parts;
      const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
      setAnchor(jalaliToGregorianExact(ny, nm, 1)!);
    } else {
      const { y, m } = view.parts;
      const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
      setAnchor(`${ny}-${pad(nm)}-01`);
    }
  };

  const eventColor: Record<DayEvent, string> = {
    onboard: colors.info,
    leave: colors.success,
    expiry: colors.danger,
    contract_start: colors.primary,
    contract_end: colors.warning,
  };

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('calendar.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Card>
        <View style={styles.monthRow}>
          <Pressable onPress={prev} hitSlop={12}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>{'‹'}</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{view.title}</Text>
          <Pressable onPress={next} hitSlop={12}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>{'›'}</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {weekdayLabels.map((label, i) => (
            <Text key={`w${i}`} style={[styles.weekLabel, { color: colors.textMuted }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`e${i}`} style={styles.cell} />;
            const iso = view.isoForDay(day);
            const dayEvents = events.get(iso);
            const isToday = iso === today;
            return (
              <View
                key={iso}
                style={[
                  styles.cell,
                  { backgroundColor: isToday ? colors.primaryMuted : 'transparent', borderRadius: Radius.sm },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 13, textAlign: 'center' }}>{day}</Text>
                <View style={styles.dots}>
                  {dayEvents
                    ? [...dayEvents].map((e) => (
                        <View key={e} style={[styles.dot, { backgroundColor: eventColor[e] }]} />
                      ))
                    : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>
      <Card>
        <LegendRow label={t('calendar.legend.onBoard')} color={eventColor.onboard} textColor={colors.text} />
        <LegendRow label={t('calendar.legend.leave')} color={eventColor.leave} textColor={colors.text} />
        <LegendRow label={t('calendar.legend.contractStart')} color={eventColor.contract_start} textColor={colors.text} />
        <LegendRow label={t('calendar.legend.contractEnd')} color={eventColor.contract_end} textColor={colors.text} />
        <LegendRow label={t('calendar.legend.docExpiry')} color={eventColor.expiry} textColor={colors.text} />
      </Card>
    </ScrollView>
  );
}

function LegendRow({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.dot, { backgroundColor: color, width: 12, height: 12 }]} />
      <Text style={{ color: textColor }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, paddingVertical: 4, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
});
