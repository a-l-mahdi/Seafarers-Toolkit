import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { useFormattedDate } from '@/hooks/use-date-format';
import { contractFinance, formatMoney } from '@/domain/contract-finance';
import { earnedLeaveDays } from '@/domain/leave';
import { contractPhase } from '@/domain/contract';
import { Radius, Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';
import type { LeaveSettings } from '@/types/domain';

type Tone = 'primary' | 'success' | 'warning';

/**
 * ‹ Trip 2 of 5 › — steps through a rank's trips without having to hit close
 * chart points. Laid out left-to-right like the chart (‹ = older, › = newer).
 */
export function TripNavigator({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const arrow = (dir: -1 | 1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? t('profile.trip.previous') : t('profile.trip.next')}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChange(index + dir)}
      hitSlop={10}
      android_ripple={{ color: colors.success, borderless: true, radius: 17 }}
      style={({ pressed }) => [
        navStyles.arrow,
        {
          backgroundColor: enabled ? colors.successMuted : colors.surfaceMuted,
          opacity: enabled ? (pressed ? 0.7 : 1) : 0.45,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Ionicons
        name={dir < 0 ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={enabled ? colors.success : colors.textMuted}
      />
    </Pressable>
  );

  return (
    <View style={navStyles.row}>
      {arrow(-1, canPrev)}
      <View style={navStyles.center}>
        <Text style={[navStyles.counter, { color: colors.text }]}>
          {t('profile.trip.counter', { current: index + 1, total })}
        </Text>
        <View style={navStyles.dots}>
          {total <= 12
            ? Array.from({ length: total }, (_, i) => (
                <View
                  key={i}
                  style={[
                    navStyles.dot,
                    i === index
                      ? { width: 14, backgroundColor: colors.success }
                      : { backgroundColor: colors.border },
                  ]}
                />
              ))
            : null}
        </View>
      </View>
      {arrow(1, canNext)}
    </View>
  );
}

const navStyles = StyleSheet.create({
  // Fixed left-to-right, matching the chart's time axis in both languages.
  row: { direction: 'ltr', flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.md },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', gap: 4 },
  counter: { fontSize: 13, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center', minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});

/**
 * Summary of one trip (contract) picked on the rank-trips chart: vessel and
 * dates, then sea days, leave and earnings as tiles, then the trip notes.
 * Anything the contract has no value for is left out.
 */
export function TripDetail({
  contract,
  days,
  leaveSettings,
}: {
  contract: ContractListRow;
  days: number;
  leaveSettings: LeaveSettings;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();

  const ongoing = contractPhase(contract) === 'active';
  const endDate = contract.actualSignOff ?? contract.expectedSignOff;
  const leave = earnedLeaveDays(leaveSettings, days);
  const fin = contractFinance(contract);
  // Completed: full wage + travel + bonus. Ongoing: wage so far + travel.
  const earnings = ongoing ? fin.earnedToDate + fin.travelPay : fin.totalWithTravel;
  const notes = contract.notes?.trim() ?? '';

  const tiles: { key: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone; value: string; label: string }[] = [
    { key: 'days', icon: 'boat', tone: 'primary', value: `${days}`, label: t('profile.trip.days') },
  ];
  if (leave > 0) {
    tiles.push({ key: 'leave', icon: 'airplane', tone: 'success', value: `${leave}`, label: t('profile.trip.leave') });
  }
  if (fin.hasWage && earnings > 0) {
    tiles.push({
      key: 'pay',
      icon: 'wallet',
      tone: 'warning',
      value: formatMoney(earnings, fin.currency),
      label: t('profile.trip.earnings'),
    });
  }

  const toneColor = (tone: Tone) =>
    tone === 'primary' ? colors.primary : tone === 'success' ? colors.success : colors.warning;
  const toneBg = (tone: Tone) =>
    tone === 'primary' ? colors.primaryMuted : tone === 'success' ? colors.successMuted : colors.warningMuted;

  return (
    <View style={[styles.root, { borderTopColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.vesselIcon, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="boat-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.vessel, { color: colors.text }]} numberOfLines={1}>
            {contract.vesselName ?? '—'}
          </Text>
          <Text style={[styles.dates, { color: colors.textMuted }]} numberOfLines={1}>
            {formatDate(contract.joinDate)} → {formatDate(endDate)}
          </Text>
        </View>
        {ongoing ? (
          <View style={[styles.badge, { backgroundColor: colors.successMuted }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>{t('profile.trip.ongoing')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.key} style={[styles.tile, { backgroundColor: toneBg(tile.tone) }]}>
            <Ionicons name={tile.icon} size={18} color={toneColor(tile.tone)} />
            <Text style={[styles.tileValue, { color: toneColor(tile.tone) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {tile.value}
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>

      {notes ? (
        <View style={[styles.notes, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.notesHead}>
            <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.notesTitle, { color: colors.textMuted }]}>{t('profile.trip.notes')}</Text>
          </View>
          <Text style={[styles.notesText, { color: colors.text }]}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.sm, paddingTop: Spacing.md, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  vesselIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vessel: { fontSize: 16, fontWeight: '700' },
  dates: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, alignItems: 'center', gap: 4 },
  tileValue: { fontSize: 17, fontWeight: '800' },
  tileLabel: { fontSize: 11, fontWeight: '600' },
  notes: { borderRadius: Radius.md, padding: Spacing.md, gap: 6 },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesTitle: { fontSize: 12, fontWeight: '700' },
  notesText: { fontSize: 14, lineHeight: 21 },
});
