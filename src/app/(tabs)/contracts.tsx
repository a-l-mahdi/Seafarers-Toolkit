import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/primitives';
import { ContractCard } from '@/components/contract-card';
import { useContracts, useRanks } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { buildRankColorMap } from '@/domain/rank-color';
import { Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/database/repositories';
import { useFloatingTabBarPadding } from '@/components/floating-tab-bar';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { useTabScrollReset, withTabStrip } from '@/components/tab-strip';

function ContractsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const tabPad = useFloatingTabBarPadding();
  const headerPad = useFloatingHeaderPadding();
  const { data: contracts, isLoading } = useContracts();
  const { data: ranks } = useRanks();
  const scrollRef = useTabScrollReset<FlatList<ContractListRow>>();

  // rankId → branch colour (gold/purple/green/petrol-blue/silver, shaded by seniority).
  const rankColors = useMemo(() => buildRankColorMap(ranks ?? []), [ranks]);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TelegramHeader
        title={t('contracts.title')}
        actions={[
          { icon: 'add', label: t('common.add'), onPress: () => router.push('/contract-form') },
        ]}
      />
      <FlatList ref={scrollRef} nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabPad }]}
        data={contracts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContractCard
            item={item}
            tripNo={tripNumbers.get(item.id) ?? 1}
            rankColor={rankColors.get(item.rankId ?? '') ?? '#5B6B7A'}
          />
        )}
        ListEmptyComponent={isLoading ? null : <EmptyState title={t('contracts.noContracts')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
});

export default withTabStrip(ContractsScreen, 2);
