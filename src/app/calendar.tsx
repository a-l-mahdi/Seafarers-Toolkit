import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { useContracts, useDocuments, useLeaveSettings } from '@/hooks/queries';
import { expectedReturnDate } from '@/domain/leave';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';

type DayEvent = 'onboard' | 'leave' | 'expiry' | 'contract_start' | 'contract_end';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: leaveSettings } = useLeaveSettings();

  const events = useMemo(() => {
    const map = new Map<string, Set<DayEvent>>();
    const add = (iso: string, event: DayEvent) => {
      if (!iso) return;
      const [y, m] = iso.split('-').map(Number);
      if (y !== year || m - 1 !== month) return;
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
        const next = new Date(Date.UTC(y, m - 1, d + 1));
        cursor = next.toISOString().slice(0, 10);
        guard += 1;
      }
      if (!c.actualSignOff && leaveSettings) {
        let leaveCursor = end;
        const returnDate = expectedReturnDate(end, leaveSettings);
        let guard2 = 0;
        while (leaveCursor < returnDate && guard2 < 400) {
          add(leaveCursor, 'leave');
          const [y, m, d] = leaveCursor.split('-').map(Number);
          const next = new Date(Date.UTC(y, m - 1, d + 1));
          leaveCursor = next.toISOString().slice(0, 10);
          guard2 += 1;
        }
      }
    }
    for (const doc of documents ?? []) {
      if (doc.expiryDate) add(doc.expiryDate, 'expiry');
    }
    return map;
  }, [contracts, documents, leaveSettings, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayISOStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const prev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
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
          <Pressable onPress={prev}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>{'‹'}</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {year}-{String(month + 1).padStart(2, '0')}
          </Text>
          <Pressable onPress={next}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>{'›'}</Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`e${i}`} style={styles.cell} />;
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events.get(iso);
            const isToday = isCurrentMonth && iso === todayISOStr;
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
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, paddingVertical: 4, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
});
