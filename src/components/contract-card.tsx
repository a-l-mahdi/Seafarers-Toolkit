import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Button, ProgressBar } from '@/components/ui/primitives';
import { contractCountdown, contractProgressColor, type ContractCountdown } from '@/domain/contract';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/utils/date';
import { Radius, Spacing } from '@/constants/theme';
import { useSignOffContract, type ContractListRow } from '@/hooks/queries';

const STATUS_TONE = { active: 'success', planned: 'info', completed: 'muted' } as const;

/**
 * Contract card following the black wireframe layout:
 * 1) full-height rank-colored accent strip, 2) square trip-number badge
 * (digit only, dark bg / white number), 3) vessel name, 4) status chip,
 * 5) dates + duration row, 6) rank chip beside it, 7) progress section for
 * active contracts only. Accent color and trip number come in via props.
 */
export function ContractCard({
  item,
  tripNo,
  rankColor,
}: {
  item: ContractListRow;
  /** Trip number within the rank (digit only, controlled by the caller). */
  tripNo: number;
  /** Dynamic accent color for the strip (based on rank/grade). */
  rankColor: string;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const signOff = useSignOffContract();
  const countdown: ContractCountdown = contractCountdown(item);

  const confirmSignOff = () => {
    Alert.alert(t('contracts.signOff'), t('contracts.signOffConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => signOff.mutate({ id: item.id, date: todayISO() }),
      },
    ]);
  };

  return (
    <Link href={`/contract-form?id=${item.id}`} asChild>
      <Pressable
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* 1) Rank accent strip — full card height, no text */}
        <View style={[styles.accent, { backgroundColor: rankColor }]} />

        {/* 2) Square trip-number badge: digit only */}
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{String(tripNo)}</Text>
        </View>

        <View style={{ flex: 1, gap: Spacing.xs, paddingVertical: Spacing.md, paddingRight: Spacing.md }}>
          {/* 3) Vessel name + 4) status chip */}
          <View style={styles.headerRow}>
            <Text style={[styles.name, { color: colors.text }]}>{item.vesselName ?? '—'}</Text>
            <Badge label={t(`contracts.${item.status}`)} tone={STATUS_TONE[item.status]} />
          </View>

          {/* 5) dates + duration · 6) rank chip on the side */}
          <View style={styles.dateRow}>
            <View style={[styles.rankChip, { backgroundColor: rankColor }]}>
              <Text style={styles.rankChipText}>{item.rankName ?? '—'}</Text>
            </View>
            <Text style={[styles.dates, { color: colors.textMuted }]} numberOfLines={1}>
              {formatDate(item.joinDate)} → {formatDate(item.actualSignOff ?? item.expectedSignOff)}
              {` · ${item.durationDays ?? countdown.totalDays} ${t('common.days')}`}
            </Text>
          </View>

          {/* 7) Active-only bottom section */}
          {!item.actualSignOff ? (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <ProgressBar progress={countdown.progress} color={contractProgressColor(colors, countdown)} />
              <Text style={[styles.remaining, { color: colors.textMuted }]}>
                {t('dashboard.remaining')}: {countdown.remainingDays} {t('common.days')}
              </Text>
              <Button
                label={t('contracts.signOff')}
                variant="secondary"
                style={styles.signOffBtn}
                onPress={confirmSignOff}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  accent: { width: 5, alignSelf: 'stretch' },
  numberBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginHorizontal: Spacing.sm,
  },
  numberText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rankChip: {
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  rankChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dates: { fontSize: 13, flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.xs, paddingTop: Spacing.sm, gap: Spacing.sm },
  remaining: { fontSize: 13 },
  signOffBtn: { marginTop: 2 },
});
