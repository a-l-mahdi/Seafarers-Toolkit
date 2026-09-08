import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { useContracts, useSignOffContract } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { contractCountdown } from '@/domain/contract';
import { todayISO } from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';

export default function ContractsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: contracts, isLoading } = useContracts();

  const statusTone = { active: 'success', planned: 'info', completed: 'muted' } as const;

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
      <FlatList
        contentContainerStyle={styles.list}
        data={contracts ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContractRow item={item} statusTone={statusTone} />}
        ListEmptyComponent={isLoading ? null : <EmptyState title={t('contracts.noContracts')} />}
      />
    </View>
  );
}

function ContractRow({ item, statusTone }: { item: ContractListRow; statusTone: Record<string, 'success' | 'info' | 'muted'> }) {
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
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: colors.text }]}>{item.vesselName ?? '—'}</Text>
          <Badge label={t(`contracts.${item.status}`)} tone={statusTone[item.status]} />
        </View>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {item.rankName ?? '—'} · {formatDate(item.joinDate)} → {formatDate(item.actualSignOff ?? item.expectedSignOff)}
        </Text>
        {!item.actualSignOff ? (
          <>
            <ProgressBar progress={countdown.progress} />
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
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
});
