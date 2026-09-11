import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Card, FieldRow } from '@/components/ui/primitives';
import { useContracts, useDocuments, useProfile, useRanks, useSeaTimeSummary } from '@/hooks/queries';
import { contractCountdown } from '@/domain/contract';
import { promotionDaysFromMonths } from '@/domain/career';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();

  const rankName = (id: string | null) => ranks?.find((r) => r.id === id)?.name ?? '—';
  const currentRank = ranks?.find((r) => r.id === profile?.currentRankId) ?? null;
  const required = promotionDaysFromMonths(currentRank?.promotionMonths ?? null);

  return (
    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('reports.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.seaTimeSummary')}</Text>
        <FieldRow label={t('seaTime.total')} value={`${seaTime?.total.days ?? 0} ${t('common.days')}`} />
        {(seaTime?.byRank ?? []).map((row) => (
          <FieldRow key={row.rankId ?? 'none'} label={row.rankName} value={`${row.days} ${t('common.days')}`} />
        ))}
      </Card>

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.careerSummary')}</Text>
        <FieldRow label={t('career.currentRank')} value={rankName(profile?.currentRankId ?? null)} />
        <FieldRow label={t('career.nextRank')} value={rankName(profile?.nextRankId ?? null)} />
        <FieldRow label={t('career.requiredSeaTime')} value={`${required} ${t('common.days')}`} />
      </Card>

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.contractHistory')}</Text>
        {(contracts ?? []).map((c) => {
          const cd = contractCountdown(c);
          return (
            <View key={c.id} style={styles.contractRow}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{c.vesselName ?? '—'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {formatDate(c.joinDate)} → {formatDate(c.actualSignOff ?? c.expectedSignOff)} · {cd.totalDays} {t('common.days')}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('reports.documentStatus')}</Text>
        <View style={styles.badges}>
          <Badge label={`${t('dashboard.valid')}: ${(documents ?? []).filter((d) => d.status === 'valid').length}`} tone="success" />
          <Badge
            label={`${t('dashboard.expiringSoon')}: ${(documents ?? []).filter((d) => d.status === 'expiring_soon' || d.status === 'not_valid').length}`}
            tone="warning"
          />
          <Badge label={`${t('dashboard.expired')}: ${(documents ?? []).filter((d) => d.status === 'expired').length}`} tone="danger" />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  contractRow: { paddingVertical: 6, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
