import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, FieldRow } from '@/components/ui/primitives';
import { useDeleteSeaTimeRecord, useProfile, useRanks, useSeaTimeRecords, useSeaTimeSummary } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormattedDate } from '@/hooks/use-date-format';
import { Radius, Spacing } from '@/constants/theme';

export default function SeaTimeScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const router = useRouter();
  const { data: summary } = useSeaTimeSummary();
  const { data: records } = useSeaTimeRecords();
  const { data: ranks } = useRanks();
  const { data: profile } = useProfile();
  const remove = useDeleteSeaTimeRecord();

  const rankName = (id: string | null) => (id ? ranks?.find((r) => r.id === id)?.name ?? id : '—');

  const confirmDelete = (id: string) => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('seaTime.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <Link href="/sea-time-form" style={{ color: colors.primary, fontWeight: '600' }}>
              + {t('common.add')}
            </Link>
          ),
        }}
      />
      <FlatList nestedScrollEnabled
        contentContainerStyle={[styles.list, { paddingBottom: Spacing.xxl + insets.bottom }]}
        ListHeaderComponent={
          <>
            <Card>
              <FieldRow
                label={t('seaTime.total')}
                value={`${summary?.total.days ?? 0} ${t('common.days')}${summary?.total.hours ? ` ${summary.total.hours}h` : ''}`}
              />
            </Card>
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('seaTime.byRank')}</Text>
              {(summary?.byRank.length ?? 0) === 0 ? (
                <EmptyState title={t('seaTime.noRecords')} />
              ) : (
                summary!.byRank.map((row) => (
                  <FieldRow
                    key={row.rankId ?? 'none'}
                    label={row.rankName}
                    value={`${row.days} ${t('common.days')}${row.hours ? ` ${row.hours}h` : ''}`}
                  />
                ))
              )}
            </Card>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
              {t('seaTime.manual')}
            </Text>
          </>
        }
        data={records ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              if (item.contractId) {
                router.push(`/trip-files?contractId=${item.contractId}`);
              }
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {rankName(item.rankId)} · {item.days} {t('common.days')}
                {item.hours ? ` ${item.hours}h` : ''}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {formatDate(item.fromDate) ?? '—'} → {formatDate(item.toDate) ?? '—'}
                {item.verified ? ` · ${t('seaTime.verified')}` : ''}
              </Text>
            </View>
            {item.contractId ? (
              <Text style={{ color: colors.primary, fontSize: 13 }}>{t('tripFiles.open')}</Text>
            ) : (
              <Text style={{ color: colors.danger }} onPress={() => confirmDelete(item.id)}>
                ✕
              </Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title={t('seaTime.noRecords')} />}
      />
      {!profile ? null : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
});
