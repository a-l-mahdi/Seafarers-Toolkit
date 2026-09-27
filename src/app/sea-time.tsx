import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, FieldRow } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { useDeleteSeaTimeRecord, useRanks, useSeaTimeRecords, useSeaTimeSummary } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFormattedDate } from '@/hooks/use-date-format';
import { Radius, Spacing } from '@/constants/theme';

export default function SeaTimeScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const formatDate = useFormattedDate();
  const router = useRouter();
  const { data: summary } = useSeaTimeSummary();
  const { data: records } = useSeaTimeRecords();
  const { data: ranks } = useRanks();
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
      <TelegramHeader title={t('seaTime.title')} onBack={() => router.back()} />
      <FlatList showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
        ListHeaderComponent={
          <>
            <Card>
              <FieldRow
                label={t('seaTime.total')}
                value={`${summary?.total.days ?? 0} ${t('common.days')}${summary?.total.hours ? ` ${summary.total.hours}h` : ''}`}
              />
            </Card>
            {summary && summary.byRank.length > 0 ? (
              <Card>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('seaTime.byRank')}</Text>
                {summary.byRank.map((row) => (
                  <FieldRow
                    key={row.rankId ?? 'none'}
                    label={row.rankName}
                    value={`${row.days} ${t('common.days')}${row.hours ? ` ${row.hours}h` : ''}`}
                  />
                ))}
              </Card>
            ) : null}
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.sm }}>
              {t('career.addSeaTimeHint')}
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
      />
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
