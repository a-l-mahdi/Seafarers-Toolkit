import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { useContracts, useSignOffContract } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { contractCountdown, contractProgressColor } from '@/domain/contract';
import { todayISO } from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';

export default function ContractsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: contracts, isLoading } = useContracts();

  const statusTone = { active: 'success', planned: 'info', completed: 'muted' } as const;

  // Trip number per rank: chronological counter within each rank (1 = first trip).
  const tripNumbers = useMemo(() => {
    const counters = new Map<string, number>();
    const result = new Map<string, number>();
    const sorted = [...(contracts ?? [])].sort((a, b) => (a.joinDate < b.joinDate ? -1 : 1));
    for (const c of sorted) {
      const key = c.rankId || 'none';
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      result.set(c.id, next);
    }
    return result;
  }, [contracts]);

  const rankColorOf = (rankId: string | null): string =>
    rankColor(rankId ?? 'unranked');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('contracts.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <Link href="/contract-form" style={{ color: colors.primary, fontWeight: '600' }}>
              + {t('common.add')}
            </Link>
          ),
        }}
      />
      <FlatList nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        data={contracts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContractRow
            item={item}
            statusTone={statusTone}
            tripNo={tripNumbers.get(item.id) ?? 1}
            rankColor={rankColorOf(item.rankId)}
          />
        )}
        ListEmptyComponent={isLoading ? null : <EmptyState title={t('contracts.noContracts')} />}
      />
    </View>
  );
}

function ContractRow({
  item,
  statusTone,
  tripNo,
  rankColor,
}: {
  item: ContractListRow;
  statusTone: Record<string, 'success' | 'info' | 'muted'>;
  tripNo: number;
  rankColor: string;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const signOff = useSignOffContract();
  const countdown = contractCountdown(item);

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
      <Pressable style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Per-rank accent stripe so every rank's trips are visually grouped */}
        <View style={[styles.rankStripe, { backgroundColor: rankColor }]} />
        <View style={{ flex: 1, gap: Spacing.xs }}>
          <View style={styles.headerRow}>
            <Text style={[styles.name, { color: colors.text }]}>{item.vesselName ?? '—'}</Text>
            <View style={styles.headerBadges}>
              <View style={[styles.tripBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.tripBadgeText}>{t('contracts.tripNo', { n: tripNo })}</Text>
              </View>
              <Badge label={t(`contracts.${item.status}`)} tone={statusTone[item.status]} />
            </View>
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {item.rankName ?? '—'} · {formatDate(item.joinDate)} →{' '}
            {formatDate(item.actualSignOff ?? item.expectedSignOff)} ·{' '}
            {item.durationDays ?? countdown.totalDays} {t('common.days')}
          </Text>
          {!item.actualSignOff ? (
            <>
              <ProgressBar progress={countdown.progress} color={contractProgressColor(colors, countdown)} />
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {t('dashboard.remaining')}: {countdown.remainingDays} {t('common.days')}
              </Text>
              <Text
                style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}
                onPress={confirmSignOff}
              >
                {t('contracts.signOff')}
              </Text>
            </>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

/** Deterministic, stable color per rank id (same rank → same hue everywhere). */
export function rankColor(rankId: string): string {
  let hash = 0;
  for (let i = 0; i < rankId.length; i += 1) {
    hash = (hash * 31 + rankId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 42%)`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  rankStripe: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tripBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
});
