import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, FieldRow, ProgressBar } from '@/components/ui/primitives';
import { useContracts, useDocuments, useLeaveSettings, useProfile, useRanks, useSeaTimeSummary } from '@/hooks/queries';
import { careerProgress, estimatedQualificationDate, isTopRank, nextRankId, promotionDaysFromMonths } from '@/domain/career';
import { contractCountdown, contractProgressColor } from '@/domain/contract';
import { computeLeaveLedger, daysUntilReturn } from '@/domain/leave';
import { todayISO } from '@/utils/date';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: leaveSettings } = useLeaveSettings();

  const rankName = (id: string | null) => ranks?.find((r) => r.id === id)?.name ?? null;
  const currentRank = ranks?.find((r) => r.id === profile?.currentRankId) ?? null;
  const atTopRank = isTopRank(profile?.currentRankId ?? null, ranks ?? []);
  const nextId = nextRankId(profile?.currentRankId ?? null, ranks ?? []);
  const activeContract = contracts?.find((c) => c.status === 'active' && !c.actualSignOff) ?? null;
  const today = todayISO();

  const completedByRank = seaTime?.byRank.find(
    (r) => profile?.currentRankId && r.rankId === profile.currentRankId
  );
  const required = promotionDaysFromMonths(currentRank?.promotionMonths ?? null);
  const progress = careerProgress(completedByRank?.days ?? 0, required);
  const estimated = estimatedQualificationDate(
    progress.remaining,
    activeContract?.joinDate ?? null,
    activeContract?.expectedSignOff ?? null
  );

  const docStats = { valid: 0, expiring_soon: 0, not_valid: 0, expired: 0, no_expiry: 0 };
  for (const doc of documents ?? []) docStats[doc.status] += 1;
  // Documents past the minimum departure validity count as near-expiry too.
  const nearExpiry = docStats.expiring_soon + docStats.not_valid;

  const lastOffContract = contracts
    ?.filter((c) => c.actualSignOff)
    .sort((a, b) => (a.actualSignOff! < b.actualSignOff! ? -1 : 1))
    .at(-1) ?? null;
  const lastSignOff = lastOffContract?.actualSignOff ?? null;
  const onLeave = lastSignOff !== null && (!activeContract || activeContract.joinDate > today);
  const ledger = contracts && leaveSettings ? computeLeaveLedger(contracts, leaveSettings) : null;
  const returnDate = onLeave ? (ledger?.lastReturnDate ?? null) : null;
  const unusedLeave = ledger?.unusedNow ?? 0;

  const alerts: { tone: 'danger' | 'warning' | 'success'; text: string }[] = [];
  if (docStats.expired > 0) alerts.push({ tone: 'danger', text: `${docStats.expired} ${t('documents.status.expired')}` });
  if (nearExpiry > 0) alerts.push({ tone: 'warning', text: `${nearExpiry} ${t('documents.status.expiring_soon')}` });
  // No "requirement complete" alert at the top rank — there is no promotion left.
  if (progress.complete && !atTopRank) alerts.push({ tone: 'success', text: t('career.complete') });

  const countdown = activeContract ? contractCountdown(activeContract) : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.container, { paddingTop: Spacing.lg + insets.top }]} style={{ backgroundColor: colors.background }}>
      <Text style={[styles.greeting, { color: colors.text }]}>
        {profile ? t('dashboard.greeting', { name: profile.firstName || profile.lastName }) : t('dashboard.greetingGuest')}
      </Text>
      {!profile ? (
        <Card>
          <Text style={{ color: colors.textMuted }}>{t('dashboard.setupProfile')}</Text>
          <Button label={t('profile.title')} onPress={() => router.push('/profile-form')} style={styles.cta} />
        </Card>
      ) : null}

      <Card>
        <FieldRow label={t('dashboard.currentRank')} value={rankName(profile?.currentRankId ?? null) ?? t('common.notSet')} />
        <FieldRow
          label={t('dashboard.nextRank')}
          value={
            isTopRank(profile?.currentRankId ?? null, ranks ?? [])
              ? t('career.topRank')
              : rankName(nextId) ?? t('common.notSet')
          }
        />
        <FieldRow
          label={t('dashboard.status')}
          value={onLeave ? t('dashboard.onLeave') : activeContract ? t('dashboard.onboard') : t('dashboard.available')}
        />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('seaTime.title')}</Text>
        <FieldRow label={t('seaTime.total')} value={`${seaTime?.total.days ?? 0} ${t('common.days')}`} />
        {atTopRank ? (
          <Text style={{ color: colors.success, fontWeight: '600' }}>{t('career.topRank')}</Text>
        ) : (
          <>
            <FieldRow
              label={t('career.completed')}
              value={`${completedByRank?.days ?? 0} / ${required} ${t('common.days')}`}
            />
            <FieldRow label={t('career.remaining')} value={`${progress.remaining} ${t('common.days')}`} />
            <ProgressBar progress={progress.progress} tone={progress.complete ? 'success' : 'primary'} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {Math.round(progress.progress * 100)}%
              {estimated ? ` · ${t('career.estimatedDate')}: ${formatDate(estimated)}` : ''}
            </Text>
          </>
        )}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.currentContract')}</Text>
        {activeContract && countdown ? (
          <>
            <FieldRow label={t('vessels.title')} value={activeContract.vesselName} />
            <FieldRow label={t('contracts.rank')} value={activeContract.rankName} />
            <FieldRow label={t('dashboard.joinDate')} value={formatDate(activeContract.joinDate)} />
            <FieldRow label={t('dashboard.signOff')} value={formatDate(activeContract.expectedSignOff)} />
            <FieldRow label={t('dashboard.remaining')} value={`${countdown.remainingDays} ${t('common.days')}`} />
            {unusedLeave > 0 ? (
              <FieldRow label={t('dashboard.unusedLeave')} value={`${unusedLeave} ${t('common.days')}`} />
            ) : null}
            <ProgressBar progress={countdown.progress} color={contractProgressColor(colors, countdown)} />
          </>
        ) : (
          <EmptyState title={t('dashboard.noActiveContract')} />
        )}
      </Card>

      {onLeave && returnDate ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.leave')}</Text>
          <FieldRow label={t('dashboard.unusedLeave')} value={`${unusedLeave} ${t('common.days')}`} />
          <FieldRow label={t('dashboard.expectedReturn')} value={formatDate(returnDate)} />
          <FieldRow label={t('dashboard.daysRemaining')} value={`${daysUntilReturn(returnDate)}`} />
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.documents')}</Text>
        <View style={styles.badges}>
          <Badge label={`${t('dashboard.valid')}: ${docStats.valid}`} tone="success" />
          <Badge label={`${t('dashboard.expiringSoon')}: ${nearExpiry}`} tone="warning" />
          <Badge label={`${t('dashboard.expired')}: ${docStats.expired}`} tone="danger" />
        </View>
      </Card>

      {alerts.length > 0 ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('dashboard.alerts')}</Text>
          <View style={styles.badges}>
            {alerts.map((a, i) => (
              <Badge key={i} label={a.text} tone={a.tone} />
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  greeting: { fontSize: 24, fontWeight: '700', marginTop: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cta: { marginTop: Spacing.sm },
});
