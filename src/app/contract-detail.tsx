import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState } from '@/components/ui/primitives';
import { DatePickerField } from '@/components/ui/date-picker';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import { useContracts, useLeaveSettings, useTripFiles } from '@/hooks/queries';
import type { TripFileKind } from '@/database/repositories/trip-files-repository';
import { useFormattedDate } from '@/hooks/use-date-format';
import { contractCountdown, contractProgressColor } from '@/domain/contract';
import { contractFinance, projectSignOff, formatMoney } from '@/domain/contract-finance';
import { earnedLeaveDays } from '@/domain/leave';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDaysISO, isISODate, todayISO } from '@/utils/date';
import { Radius, Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';
import type { LeaveSettings } from '@/types/domain';

export default function ContractDetailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: contracts } = useContracts();
  const contract = contracts?.find((c) => c.id === id) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: contract?.vesselName ?? t('contracts.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () =>
            contract ? (
              <Pressable onPress={() => router.push(`/contract-form?id=${contract.id}`)} hitSlop={8}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('common.edit')}</Text>
              </Pressable>
            ) : null,
        }}
      />
      {contract ? <ContractBody contract={contract} /> : <EmptyState title={t('contracts.notFound')} />}
    </View>
  );
}

/** A labelled progress bar (fraction 0..1). */
function Bar({
  label,
  detail,
  fraction,
  color,
  track,
}: {
  label: string;
  detail: string;
  fraction: number;
  color: string;
  track: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.barBlock}>
      <View style={styles.barHead}>
        <Text style={[styles.barLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.barDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.fill, { width: `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Read-only card showing every document attached to this contract, grouped by
 *  kind (contract copy / sea service report / final wages), as large tiles. */
function ContractDocsCard({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: files } = useTripFiles({ contractId });

  const groups: { kind: TripFileKind; label: string }[] = [
    { kind: 'contract', label: t('tripFiles.contract') },
    { kind: 'sea_service_report', label: t('tripFiles.seaServiceReport') },
    { kind: 'final_wages', label: t('tripFiles.finalWages') },
    { kind: 'other', label: t('tripFiles.open') },
  ];
  const toDisplay = (kind: TripFileKind): DisplayFile[] =>
    (files ?? [])
      .filter((f) => f.kind === kind)
      .map((f) => ({ id: f.id, uri: f.localPath, name: f.fileName }));

  if ((files ?? []).length === 0) return null;

  return (
    <Card>
      <Text style={[styles.section, { color: colors.text }]}>{t('contractDetail.documents')}</Text>
      {groups.map((g) => {
        const display = toDisplay(g.kind);
        if (display.length === 0) return null;
        return (
          <View key={g.kind} style={styles.docGroup}>
            <Text style={[styles.docGroupTitle, { color: colors.textMuted }]}>{g.label}</Text>
            <FileGallery files={display} large />
          </View>
        );
      })}
    </Card>
  );
}

/** A numeric stat tile. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text style={[styles.statHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

function ContractBody({ contract }: { contract: ContractListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const { data: leaveSettings } = useLeaveSettings();
  const settings: LeaveSettings =
    leaveSettings ?? { mode: 'ratio', onboardDays: 120, leaveDays: 60, manualLeaveStartDate: null, manualLeaveEndDate: null };

  const cd = contractCountdown(contract);
  const fin = contractFinance(contract);
  const endDate = contract.actualSignOff ?? contract.expectedSignOff;
  const isActive = contract.status === 'active';

  const leaveToday = earnedLeaveDays(settings, cd.elapsedDays);
  const leaveFull = earnedLeaveDays(settings, cd.totalDays);

  // Leave summary: for an active contract it's leave earned if signing off TODAY
  // (running to today + that many days); for a completed one it's the total leave
  // earned, running from the actual sign-off date.
  const leaveDaysShown = isActive ? leaveToday : leaveFull;
  const leaveFromISO = isActive ? todayISO() : endDate;
  const leaveUntilISO = addDaysISO(leaveFromISO, leaveDaysShown);

  // "If I sign off on …" projection — defaults to the expected sign-off date.
  const [projDate, setProjDate] = useState(endDate);
  const proj = isISODate(projDate) ? projectSignOff(contract, settings, projDate) : null;

  const currency = fin.currency;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl + insets.bottom }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={[styles.vessel, { color: colors.onPrimary }]} numberOfLines={1}>
          {contract.vesselName ?? '—'}
        </Text>
        <View style={styles.headerRow}>
          <Text style={[styles.headerMeta, { color: colors.onPrimary }]} numberOfLines={1}>
            {contract.rankName ?? '—'}
          </Text>
          <View style={styles.statusPill}>
            <Text style={[styles.statusText, { color: colors.primary }]}>{t(`contracts.${contract.status}`)}</Text>
          </View>
        </View>
        <Text style={[styles.headerDates, { color: colors.onPrimary }]} numberOfLines={1}>
          {formatDate(contract.joinDate)} → {formatDate(endDate)}
        </Text>
      </View>

      {/* Progress bars */}
      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('contractDetail.progress')}</Text>
        <Bar
          label={t('contractDetail.onboard')}
          detail={`${cd.elapsedDays} / ${cd.totalDays} ${t('common.days')}`}
          fraction={cd.progress}
          color={contractProgressColor(colors, cd)}
          track={colors.surfaceMuted}
        />
        <Bar
          label={t('contractDetail.leave')}
          detail={`${leaveToday} / ${leaveFull} ${t('common.days')}`}
          fraction={leaveFull > 0 ? leaveToday / leaveFull : 0}
          color={colors.success}
          track={colors.surfaceMuted}
        />
        {isActive ? (
          <Text style={[styles.remaining, { color: colors.textMuted }]}>
            {t('dashboard.remaining')}: {cd.remainingDays} {t('common.days')}
          </Text>
        ) : null}
        <View style={[styles.leaveInfo, { backgroundColor: colors.successMuted }]}>
          <Text style={[styles.leaveInfoLabel, { color: colors.text }]}>
            {isActive ? t('contractDetail.leaveToday') : t('contractDetail.leaveTotalLabel')}
          </Text>
          <Text style={[styles.leaveInfoValue, { color: colors.success }]}>
            {leaveDaysShown} {t('common.days')} · {t('contractDetail.until')} {formatDate(leaveUntilISO)}
          </Text>
        </View>
      </Card>

      {/* Wages */}
      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('contractDetail.wages')}</Text>
        {fin.hasWage ? (
          <>
            <View style={styles.statGrid}>
              {isActive ? (
                <Stat
                  label={t('contractDetail.earnedToDate')}
                  value={formatMoney(fin.earnedToDate, currency)}
                  hint={`${cd.elapsedDays} ${t('common.days')}`}
                />
              ) : null}
              <Stat
                label={t('contractDetail.earnedFull')}
                value={formatMoney(fin.earnedFullContract, currency)}
                hint={`${cd.totalDays} ${t('common.days')}`}
              />
              <Stat label={t('contractDetail.dailyRate')} value={formatMoney(fin.dailyRate, currency)} />
            </View>
            {fin.travelDays > 0 ? (
              <View style={[styles.travel, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {t('contractDetail.travel', { days: fin.travelDays })}
                </Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  + {formatMoney(fin.travelPay, currency)}
                </Text>
              </View>
            ) : null}
            {fin.bonus > 0 ? (
              <View style={[styles.travel, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('contractDetail.bonus')}</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  + {formatMoney(fin.bonus, currency)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.total, { backgroundColor: colors.primaryMuted }]}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                {t('contractDetail.totalWithTravel')}
              </Text>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>
                {formatMoney(fin.totalWithTravel, currency)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('contractDetail.noWage')}</Text>
        )}
      </Card>

      {/* If I sign off on a future date — only relevant for an active contract. */}
      {isActive ? (
        <Card>
          <Text style={[styles.section, { color: colors.text }]}>{t('contractDetail.projectionTitle')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.sm }}>
            {t('contractDetail.projectionHint')}
          </Text>
          <DatePickerField label={t('contractDetail.signOffOn')} value={projDate} onChange={setProjDate} />
          {proj ? (
            <View style={styles.statGrid}>
              <Stat label={t('contractDetail.projDays')} value={`${proj.days} ${t('common.days')}`} />
              <Stat label={t('contractDetail.projLeave')} value={`${proj.leaveDays} ${t('common.days')}`} />
              {fin.hasWage ? (
                <Stat
                  label={t('contractDetail.projWage')}
                  value={formatMoney(proj.wage, currency)}
                  hint={fin.travelDays > 0 ? t('contractDetail.inclTravel') : undefined}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Contract documents (contract copy / sea service report / final wages) */}
      <ContractDocsCard contractId={contract.id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  header: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  vessel: { fontSize: 22, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  headerMeta: { flex: 1, fontSize: 14, fontWeight: '600', opacity: 0.95 },
  statusPill: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  headerDates: { fontSize: 13, opacity: 0.95, marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  docGroup: { marginBottom: Spacing.md, gap: Spacing.xs },
  docGroupTitle: { fontSize: 13, fontWeight: '600' },
  barBlock: { marginBottom: Spacing.md },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  barLabel: { fontSize: 14, fontWeight: '600' },
  barDetail: { fontSize: 12 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  remaining: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  leaveInfo: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.sm, gap: 2 },
  leaveInfoLabel: { fontSize: 13, fontWeight: '600' },
  leaveInfoValue: { fontSize: 14, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statHint: { fontSize: 11 },
  travel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
});
