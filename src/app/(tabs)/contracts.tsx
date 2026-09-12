import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/primitives';
import { ContractCard } from '@/components/contract-card';
import { useContracts } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function ContractsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: contracts, isLoading } = useContracts();

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
          <ContractCard
            item={item}
            tripNo={tripNumbers.get(item.id) ?? 1}
            rankColor={rankColor(item.rankId ?? 'unranked', item.rankName)}
          />
        )}
        ListEmptyComponent={isLoading ? null : <EmptyState title={t('contracts.noContracts')} />}
      />
    </View>
  );
}

/** Rank accent colors: explicit palette for common ranks, stable hash fallback. */
const RANK_COLORS: { prefix: string; color: string }[] = [
  { prefix: 'ETO 1', color: '#E53935' }, // red
  { prefix: 'ETO 2', color: '#1E88E5' }, // blue
  { prefix: 'Chief', color: '#43A047' }, // green
  { prefix: '2nd', color: '#FB8C00' }, // orange
  { prefix: '3rd', color: '#8E24AA' }, // purple
];

export function rankColor(rankId: string, rankName?: string | null): string {
  if (rankName) {
    for (const entry of RANK_COLORS) {
      if (rankName.startsWith(entry.prefix)) return entry.color;
    }
  }
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
});
