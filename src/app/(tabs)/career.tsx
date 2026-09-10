import { ScrollView, StyleSheet, Text } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button, Card, EmptyState, FieldRow, ProgressBar } from '@/components/ui/primitives';
import { LabeledInput } from '@/components/ui/form';
import {
  useProfile,
  useRanks,
  useRequiredSeaTime,
  useSaveRankRequirement,
  useSeaTimeSummary,
  useContracts,
} from '@/hooks/queries';
import { careerProgress, estimatedQualificationDate, isTopRank } from '@/domain/career';
import { useTheme } from '@/hooks/use-theme';
import { useFormattedDate } from '@/hooks/use-date-format';
import { Spacing } from '@/constants/theme';

export default function CareerScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const [editing, setEditing] = useState(false);
  const [requiredInput, setRequiredInput] = useState('');

  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: contracts } = useContracts();
  const { data: required } = useRequiredSeaTime(profile?.currentRankId ?? null, profile?.nextRankId ?? null);
  const saveRequirement = useSaveRankRequirement();

  const rankName = (id: string | null) => ranks?.find((r) => r.id === id)?.name ?? null;
  const currentRank = ranks?.find((r) => r.id === profile?.currentRankId) ?? null;
  const atTopRank = isTopRank(profile?.currentRankId ?? null, ranks ?? []);
  const requiredDays = required ?? 0;
  const currentRankSeaTime =
    seaTime?.byRank.find((r) => r.rankId && r.rankId === profile?.currentRankId)?.days ?? 0;
  const progress = careerProgress(currentRankSeaTime, requiredDays);

  const activeContract = contracts?.find((c) => c.status === 'active' && !c.actualSignOff) ?? null;
  const estimated = estimatedQualificationDate(
    progress.remaining,
    activeContract?.joinDate ?? null,
    activeContract?.expectedSignOff ?? null
  );

  const startEdit = () => {
    setRequiredInput(String(requiredDays || ''));
    setEditing(true);
  };

  const submitRequirement = () => {
    if (!profile?.nextRankId) return;
    const value = parseInt(requiredInput, 10);
    if (Number.isNaN(value) || value <= 0) return;
    saveRequirement.mutate({
      id: `${profile.currentRankId ?? 'any'}_${profile.nextRankId}`,
      fromRankId: profile.currentRankId ?? null,
      toRankId: profile.nextRankId,
      requiredSeaTimeDays: value,
    });
    setEditing(false);
  };

  return (
    <ScrollView nestedScrollEnabled
      contentContainerStyle={styles.container}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('career.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <Card>
        <FieldRow
          label={t('career.currentRank')}
          value={rankName(profile?.currentRankId ?? null) ?? t('common.notSet')}
        />
        {atTopRank ? (
          <Text style={{ color: colors.success, fontWeight: '600', marginTop: 4 }}>
            {t('career.topRank')}
          </Text>
        ) : (
          <FieldRow
            label={t('career.nextRank')}
            value={rankName(profile?.nextRankId ?? null) ?? t('common.notSet')}
          />
        )}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('career.progress')}</Text>
        {editing ? (
          <>
            <LabeledInput
              label={t('career.requiredSeaTime')}
              value={requiredInput}
              onChangeText={setRequiredInput}
              keyboardType="numeric"
            />
            <Button label={t('common.save')} onPress={submitRequirement} />
          </>
        ) : (
          <>
            <FieldRow label={t('career.requiredSeaTime')} value={`${requiredDays} ${t('common.days')}`} />
            <FieldRow label={t('career.completed')} value={`${currentRankSeaTime} ${t('common.days')}`} />
            <FieldRow label={t('career.remaining')} value={`${progress.remaining} ${t('common.days')}`} />
            <ProgressBar progress={progress.progress} tone={progress.complete ? 'success' : 'primary'} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {Math.round(progress.progress * 100)}%
            </Text>
            {progress.complete ? (
              <Text style={{ color: colors.success, fontWeight: '600' }}>{t('career.complete')}</Text>
            ) : atTopRank ? (
              <Text style={{ color: colors.success, fontWeight: '600' }}>{t('career.topRank')}</Text>
            ) : (
              <FieldRow
                label={t('career.estimatedDate')}
                value={estimated ? formatDate(estimated) : t('career.notPredictable')}
              />
            )}
            {!atTopRank ? (
              <Button label={t('career.editRequirement')} onPress={startEdit} variant="secondary" />
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('career.history')}</Text>
        {(seaTime?.byRank.length ?? 0) === 0 ? (
          <EmptyState title={t('seaTime.noRecords')} />
        ) : (
          seaTime!.byRank.map((row) => (
            <FieldRow
              key={row.rankId ?? 'none'}
              label={row.rankName}
              value={`${row.days} ${t('common.days')}${row.hours ? ` ${row.hours}h` : ''}`}
            />
          ))
        )}
      </Card>

      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: Spacing.sm }}>
        {t('career.addSeaTimeHint')}
      </Text>
      <Link href="/contracts" asChild>
        <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: '600', marginTop: Spacing.xs }}>
          {t('career.goToContracts')}
        </Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});
