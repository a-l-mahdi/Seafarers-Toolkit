import { useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { MonthYearPickerModal } from '@/components/ui/date-picker';
import { useContracts, useDocuments, useLeaveSettings } from '@/hooks/queries';
import { computeLeaveLedger } from '@/domain/leave';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import {
  gregorianToJalali,
  isoToDate,
  jalaliDaysInMonth,
  jalaliToGregorianExact,
  JALALI_MONTHS,
  todayISO,
} from '@/utils/date';

type DayEvent = 'onboard' | 'leave' | 'expiry' | 'contract_start' | 'contract_end';

interface EventItem {
  event: DayEvent;
  label: string;
}

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
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: leaveSettings } = useLeaveSettings();

  const view = useMemo(
    () => buildMonthView(anchor, calendarPref, locale),
    [anchor, calendarPref, locale]
  );

  // Leave ledger: earned leave + unused leave carried from previous contracts.
  const leaveUntilByContract = useMemo(() => {
    if (!contracts || !leaveSettings) return new Map<string, string>();
    const ledger = computeLeaveLedger(contracts, leaveSettings);
    return new Map(ledger.entries.map((e) => [e.contractId, e.leaveUntil]));
  }, [contracts, leaveSettings]);

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
      // Leave window: earned leave plus unused leave carried from previous
      // contracts; stops at the next join date if the sailor reboards sooner.
      if (leaveSettings && end) {
        const leaveUntil = leaveUntilByContract.get(c.id) ?? end;
        let leaveCursor = end;
        let guard2 = 0;
        while (leaveCursor < leaveUntil && guard2 < 420) {
          add(leaveCursor, 'leave');
          const [y, m, d] = leaveCursor.split('-').map(Number);
          leaveCursor = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
          guard2 += 1;
        }
      }
    }
    for (const doc of documents ?? []) {
      if (doc.expiryDate) add(doc.expiryDate, 'expiry');
    }
    return map;
  }, [contracts, documents, leaveSettings, leaveUntilByContract]);

  /** Concrete items behind each day's events, shown in the day-detail list. */
  const dayDetails = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    const add = (iso: string, event: DayEvent, label: string) => {
      if (!iso) return;
      if (!map.has(iso)) map.set(iso, []);
      const items = map.get(iso)!;
      if (!items.some((i) => i.event === event && i.label === label)) {
        items.push({ event, label });
      }
    };
    for (const c of contracts ?? []) {
      const vessel = c.vesselName ?? '—';
      add(c.joinDate, 'contract_start', vessel);
      add(c.actualSignOff ?? c.expectedSignOff, 'contract_end', vessel);
    }
    for (const doc of documents ?? []) {
      if (doc.expiryDate) add(doc.expiryDate, 'expiry', doc.name);
    }
    return map;
  }, [contracts, documents]);

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

  const changeMonth = (dir: -1 | 1) => {
    const { y, m } = view.parts;
    let [ny, nm] = [y, m + dir];
    if (nm === 0) [ny, nm] = [y - 1, 12];
    if (nm === 13) [ny, nm] = [y + 1, 1];
    setSelected(null);
    setAnchor(
      calendarPref === 'jalali'
        ? jalaliToGregorianExact(ny, nm, 1)!
        : `${ny}-${pad(nm)}-01`
    );
  };

  // Horizontal swipe on the grid moves between months; vertical gestures
  // still pass through to the outer ScrollView (threshold on dx vs dy).
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, gs) =>
          Math.abs(gs.dx) > 24 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
        onPanResponderRelease: (_e, gs) => {
          if (gs.dx <= -60) changeMonth(1);
          else if (gs.dx >= 60) changeMonth(-1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.parts.y, view.parts.m, calendarPref]
  );

  const pickMonth = (y: number, m: number) => {
    setPickerOpen(false);
    setSelected(null);
    setAnchor(calendarPref === 'jalali' ? jalaliToGregorianExact(y, m, 1)! : `${y}-${pad(m)}-01`);
  };

  const eventColor: Record<DayEvent, string> = {
    onboard: colors.info,
    leave: colors.success,
    expiry: colors.danger,
    contract_start: colors.primary,
    contract_end: colors.warning,
  };

  const selectedDetails = selected ? (dayDetails.get(selected) ?? []) : [];
  const selectedTitle = useMemo(() => {
    if (!selected) return '';
    if (calendarPref === 'jalali') {
      const [jy, jm, jd] = gregorianToJalali(selected).split('/').map(Number);
      return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
    }
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(isoToDate(selected));
  }, [selected, calendarPref, locale]);

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
          <Pressable onPress={() => changeMonth(-1)} hitSlop={10} style={styles.arrow}>
            <Text style={[styles.arrowText, { color: colors.primary }]}>{'‹'}</Text>
          </Pressable>
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} style={styles.titleBtn}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{view.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{'▾'}</Text>
          </Pressable>
          <Pressable onPress={() => changeMonth(1)} hitSlop={10} style={styles.arrow}>
            <Text style={[styles.arrowText, { color: colors.primary }]}>{'›'}</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {weekdayLabels.map((label, i) => (
            <Text key={`w${i}`} style={[styles.weekLabel, { color: colors.textMuted }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid} {...swipe.panHandlers}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`e${i}`} style={styles.cell} />;
            const iso = view.isoForDay(day);
            const dayEvents = events.get(iso);
            const isToday = iso === today;
            const isSelected = iso === selected;
            const body = (
              <>
                <Text style={{ color: colors.text, fontSize: 13, textAlign: 'center' }}>{day}</Text>
                <View style={styles.dots}>
                  {dayEvents
                    ? [...dayEvents].map((e) => (
                        <View key={e} style={[styles.dot, { backgroundColor: eventColor[e] }]} />
                      ))
                    : null}
                </View>
              </>
            );
            const cellStyle = [
              styles.cell,
              isToday ? { backgroundColor: colors.primaryMuted, borderRadius: Radius.sm } : null,
              isSelected ? styles.selectedCell : null,
            ];
            return dayEvents ? (
              <Pressable
                key={iso}
                style={cellStyle}
                onPress={() => setSelected(iso === selected ? null : iso)}
              >
                {body}
              </Pressable>
            ) : (
              <View key={iso} style={cellStyle}>
                {body}
              </View>
            );
          })}
        </View>
      </Card>

      {pickerOpen ? (
        <MonthYearPickerModal
          calendar={calendarPref}
          year={view.parts.y}
          month={view.parts.m}
          onClose={() => setPickerOpen(false)}
          onConfirm={pickMonth}
        />
      ) : null}

      {selected && selectedDetails.length > 0 ? (
        <Card>
          <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedTitle}</Text>
          {selectedDetails.map((item, i) => (
            <View key={i} style={[styles.eventRow, { backgroundColor: eventColor[item.event] }]}>
              <Text style={styles.eventText}>
                {t(`calendar.legend.${item.event}`)}
                {item.label ? ` · ${item.label}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

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
  arrow: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  arrowText: { fontSize: 34, fontWeight: '700', lineHeight: 40 },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, paddingVertical: 4, alignItems: 'center' },
  selectedCell: { borderWidth: 2, borderRadius: Radius.sm },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  detailTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  eventRow: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: 6,
  },
  eventText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
});
