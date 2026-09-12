import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { contractCountdown, contractProgressColor, type ContractCountdown } from '@/domain/contract';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/utils/date';
import { useSignOffContract, type ContractListRow } from '@/hooks/queries';

/**
 * Contract card — compact list row laid out exactly per the reference wireframe:
 *
 *   ┌─┬────┬───────────────────────────────────┐
 *   │1│ 2  │  3 (vessel) ............ 4 (status)│
 *   │ │    │  5 (dates) .............. 6 (rank) │
 *   │ │    │  7 ───────── progress / action ────│
 *   └─┴────┴───────────────────────────────────┘
 *
 * 1) thin full-height strip in the rank color, 2) plain outlined trip-number
 * box (digit only, no fill), 3) vessel name, 4) status (active/completed),
 * 5) join → expected/actual sign-off dates, 6) rank, 7) thin progress bar with
 * a compact remaining + sign-off action (active contracts only).
 *
 * The row layout lives on an inner View (not the Pressable) so `Link asChild`
 * can't drop the flex direction.
 */
export function ContractCard({
  item,
  tripNo,
  rankColor,
}: {
  item: ContractListRow;
  /** Trip number within the rank (digit only, controlled by the caller). */
  tripNo: number;
  /** Rank/grade accent color for the strip and rank badge. */
  rankColor: string;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const signOff = useSignOffContract();
  const countdown: ContractCountdown = contractCountdown(item);

  const isActive = item.status === 'active';
  const endDate = item.actualSignOff ?? item.expectedSignOff;
  const totalDays = item.durationDays ?? countdown.totalDays;
  const statusLabel = t(`contracts.${item.status}`);

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
      <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          {/* ===== 1. Rank-color strip (full height) ===== */}
          <View style={[styles.strip, { backgroundColor: rankColor }]} />

          {/* ===== 2. Trip number — plain outlined box, no fill ===== */}
          <View style={styles.numberCol}>
            <View style={[styles.numberBox, { borderColor: colors.border }]}>
              <Text style={[styles.numberText, { color: colors.text }]}>{String(tripNo)}</Text>
            </View>
          </View>

          {/* ===== Content ===== */}
          <View style={styles.content}>
            {/* 3. Vessel + 4. Status */}
            <View style={styles.line}>
              <Text style={[styles.vessel, { color: colors.text }]} numberOfLines={1}>
                {item.vesselName ?? '—'}
              </Text>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: isActive ? colors.successMuted : colors.surfaceMuted },
                ]}
              >
                <Text
                  style={[styles.statusText, { color: isActive ? colors.success : colors.textMuted }]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            {/* 5. Dates + 6. Rank */}
            <View style={[styles.line, styles.lineGap]}>
              <Text style={[styles.dates, { color: colors.textMuted }]} numberOfLines={1}>
                {formatDate(item.joinDate)} → {formatDate(endDate)} · {totalDays} {t('common.days')}
              </Text>
              <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.rankText} numberOfLines={1}>
                  {item.rankName ?? '—'}
                </Text>
              </View>
            </View>

            {/* 7. Progress + compact action (active only) */}
            {isActive && (
              <>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.round(countdown.progress * 100)}%`,
                        backgroundColor: contractProgressColor(colors, countdown),
                      },
                    ]}
                  />
                </View>
                <View style={styles.actionRow}>
                  <Text style={[styles.remaining, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('dashboard.remaining')}: {countdown.remainingDays} {t('common.days')}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.signOffBtn,
                      { backgroundColor: colors.primary },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={confirmSignOff}
                  >
                    <Text style={[styles.signOffText, { color: colors.onPrimary }]}>
                      {t('contracts.signOff')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  // Inner row — guarantees the horizontal layout regardless of Link/Pressable.
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // 1. Rank strip
  strip: {
    width: 6,
  },

  // 2. Number box (outlined, no fill, vertically centered)
  numberCol: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  numberBox: {
    minWidth: 30,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Content
  content: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineGap: {
    marginTop: 5,
  },

  // 3. Vessel
  vessel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },

  // 4. Status
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // 5. Dates
  dates: {
    flex: 1,
    fontSize: 12,
    marginRight: 8,
  },

  // 6. Rank
  rankBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 5,
    maxWidth: 130,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // 7. Progress + action
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 9,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  remaining: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  signOffBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  signOffText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
