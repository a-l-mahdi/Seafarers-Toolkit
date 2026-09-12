import { Link } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { contractCountdown, contractProgressColor, type ContractCountdown } from '@/domain/contract';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { todayISO } from '@/utils/date';
import { useSignOffContract, type ContractListRow } from '@/hooks/queries';

/**
 * Contract card — implemented exactly per the provided reference design:
 * 1) full-height vertical accent strip colored by rank, 2) digit-only trip
 * number badge, 3) vessel name, 4) status chip, 5) dates + total days row,
 * 6) rank badge, 7) progress bar + remaining days + sign-off button (active only).
 * Accent color and trip number are fully controlled via props.
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

  const isActive = item.status === 'active';
  const endDate = item.actualSignOff ?? item.expectedSignOff;
  const totalDays = item.durationDays ?? countdown.totalDays;

  const confirmSignOff = () => {
    Alert.alert(t('contracts.signOff'), t('contracts.signOffConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => signOff.mutate({ id: item.id, date: todayISO() }),
      },
    ]);
  };

  const statusLabel = t(`contracts.${item.status}`);

  return (
    <Link href={`/contract-form?id=${item.id}`} asChild>
      <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* ===== 1. Vertical Accent Strip ===== */}
        <View style={[styles.accentStrip, { backgroundColor: rankColor }]} />

        {/* ===== Content Area ===== */}
        <View style={styles.content}>
          {/* Top row: Number badge + Title + Status */}
          <View style={styles.topRow}>
            {/* 2. Number-only badge */}
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{String(tripNo)}</Text>
            </View>

            {/* 3. Vessel name */}
            <Text style={[styles.vesselName, { color: colors.text }]} numberOfLines={1}>
              {item.vesselName ?? '—'}
            </Text>

            {/* 4. Status chip */}
            <View
              style={[
                styles.statusChip,
                isActive ? styles.statusActive : styles.statusCompleted,
              ]}
            >
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextCompleted]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Date + Rank row */}
          <View style={styles.dateRow}>
            {/* 5. Dates */}
            <Text style={[styles.dateText, { color: colors.textMuted }]} numberOfLines={1}>
              {formatDate(item.joinDate)} → {formatDate(endDate)} · {totalDays} {t('common.days')}
            </Text>

            {/* 6. Rank badge */}
            <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
              <Text style={styles.rankText}>{item.rankName ?? '—'}</Text>
            </View>
          </View>

          {/* ===== 7. Bottom section (only Active) ===== */}
          {isActive && (
            <View style={styles.bottomSection}>
              {/* Progress bar — blue shifting toward green near the end */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(countdown.progress * 100)}%`,
                      backgroundColor: contractProgressColor(colors, countdown),
                    },
                  ]}
                />
              </View>

              <Text style={[styles.remainingText, { color: colors.textMuted }]}>
                {t('dashboard.remaining')}: {countdown.remainingDays} {t('common.days')}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.signOffButton,
                  { backgroundColor: colors.surfaceMuted },
                  pressed && { opacity: 0.85 },
                ]}
                onPress={confirmSignOff}
              >
                <Text style={styles.signOffText}>{t('contracts.signOff')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },

  // 1. Vertical accent
  accentStrip: {
    width: 6,
  },

  content: {
    flex: 1,
    padding: 16,
    paddingLeft: 12,
    gap: 0,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  // 2. Number badge
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // 3. Vessel name
  vesselName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },

  // 4. Status chip
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusCompleted: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#2E7D32',
  },
  statusTextCompleted: {
    color: '#757575',
  },

  // Date + Rank
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 13,
  },

  // 6. Rank badge
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // 7. Bottom
  bottomSection: {
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  remainingText: {
    fontSize: 13,
    marginBottom: 12,
  },
  signOffButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOffText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E88E5',
  },
});
