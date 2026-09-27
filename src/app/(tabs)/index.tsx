import { useId, useState, type ReactNode } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { DEFAULT_AVATAR } from '@/constants/default-avatar';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Button, Card, EmptyState, ProgressBar } from '@/components/ui/primitives';
import {
  useCalendarNotes,
  useContracts,
  useDocuments,
  useLeaveSettings,
  useProfile,
  useRanks,
  useSeaTimeSummary,
} from '@/hooks/queries';
import { upcomingReminders } from '@/domain/calendar-events';
import { careerProgress, estimatedQualificationDate, isTopRank, promotionDaysFromMonths, resolveNextRankId } from '@/domain/career';
import { contractCountdown, contractPhase, contractProgressColor, daysUntilStart } from '@/domain/contract';
import { computeLeaveLedger, daysUntilReturn } from '@/domain/leave';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/store/settings-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import { useFloatingTabBarPadding } from '@/components/floating-tab-bar';
import { Epaulette } from '@/components/epaulette';
import { useTabScrollReset, withTabStrip } from '@/components/tab-strip';
import { gregorianToJalali, isoToDate, JALALI_MONTHS, todayISO } from '@/utils/date';

type IconName = keyof typeof Ionicons.glyphMap;

/** Today as a long date in the user's calendar, with the weekday. */
function useTodayLabel(): string {
  const calendar = useSettingsStore((s) => s.calendar);
  const locale = useSettingsStore((s) => s.locale);
  const iso = todayISO();
  const lang = locale === 'fa' ? 'fa' : 'en';
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(isoToDate(iso));
  if (calendar === 'jalali') {
    const [jy, jm, jd] = gregorianToJalali(iso).split('/').map(Number);
    return `${weekday} ${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
  }
  return new Intl.DateTimeFormat(lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(isoToDate(iso));
}

function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const scrollRef = useTabScrollReset<ScrollView>();
  const insets = useSafeAreaInsets();
  const tabPad = useFloatingTabBarPadding();
  const formatDate = useFormattedDate();
  const todayLabel = useTodayLabel();
  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: notes } = useCalendarNotes();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: leaveSettings } = useLeaveSettings();

  const rankName = (id: string | null) => ranks?.find((r) => r.id === id)?.name ?? null;
  const currentRank = ranks?.find((r) => r.id === profile?.currentRankId) ?? null;
  const atTopRank = isTopRank(profile?.currentRankId ?? null, ranks ?? []);
  const nextId = resolveNextRankId(profile?.currentRankId ?? null, profile?.nextRankId ?? null, ranks ?? []);
  const activeContract = contracts?.find((c) => contractPhase(c) === 'active') ?? null;
  // Contracts are listed newest first: the last upcoming one is the next to start.
  const upcomingContract = [...(contracts ?? [])].reverse().find((c) => contractPhase(c) === 'upcoming') ?? null;

  const completedByRank = seaTime?.byRank.find(
    (r) => profile?.currentRankId && r.rankId === profile.currentRankId
  );
  const required = promotionDaysFromMonths(currentRank?.promotionMonths ?? null);
  const progress = careerProgress(completedByRank?.days ?? 0, required);
  const plannedContract = activeContract ?? upcomingContract;
  const estimated = estimatedQualificationDate(
    progress.remaining,
    plannedContract?.joinDate ?? null,
    plannedContract?.expectedSignOff ?? null
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
  const onLeave = lastSignOff !== null && !activeContract;
  const ledger = contracts && leaveSettings ? computeLeaveLedger(contracts, leaveSettings) : null;
  const returnDate = onLeave ? (ledger?.lastReturnDate ?? null) : null;
  const unusedLeave = ledger?.unusedNow ?? 0;

  const alerts: { tone: 'danger' | 'warning' | 'success'; text: string }[] = [];
  if (docStats.expired > 0) alerts.push({ tone: 'danger', text: `${docStats.expired} ${t('documents.status.expired')}` });
  if (nearExpiry > 0) alerts.push({ tone: 'warning', text: `${nearExpiry} ${t('documents.status.expiring_soon')}` });
  // No "requirement complete" alert at the top rank — there is no promotion left.
  if (progress.complete && !atTopRank) alerts.push({ tone: 'success', text: t('career.complete') });
  // Calendar notes with a reminder still ahead.
  const reminders = upcomingReminders(notes ?? []);

  const countdown = activeContract ? contractCountdown(activeContract) : null;
  const status = onLeave
    ? { label: t('dashboard.onLeave'), icon: 'sunny' as IconName }
    : activeContract
      ? { label: t('dashboard.onboard'), icon: 'boat' as IconName }
      : { label: t('dashboard.available'), icon: 'checkmark-circle' as IconName };
  const shownContract = activeContract ?? upcomingContract;
  const toneColor = { danger: colors.danger, warning: colors.warning, success: colors.success };
  const toneIcon: Record<'danger' | 'warning' | 'success', IconName> = {
    danger: 'alert-circle',
    warning: 'time',
    success: 'trophy',
  };

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.container, { paddingTop: Spacing.lg + insets.top, paddingBottom: tabPad }]} style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
            {profile ? t('dashboard.greeting', { name: profile.firstName || profile.lastName }) : t('dashboard.greetingGuest')}
          </Text>
          <Text style={[styles.today, { color: colors.textMuted }]}>{todayLabel}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
          <Image
            source={profile?.photoPath ? { uri: profile.photoPath } : DEFAULT_AVATAR}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </View>
      </View>
      {!profile ? (
        <Card>
          <Text style={{ color: colors.textMuted }}>{t('dashboard.setupProfile')}</Text>
          <Button label={t('profile.title')} onPress={() => router.push('/profile-form')} style={styles.cta} />
        </Card>
      ) : null}

      <HeroCard aside={currentRank?.insignia ? <Epaulette insignia={currentRank.insignia} size={96} /> : null}>
        <View style={styles.heroTop}>
          <View style={styles.statusPill}>
            <Ionicons name={status.icon} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.heroLabel}>{t('dashboard.currentRank')}</Text>
        <Text style={styles.heroRank} numberOfLines={1}>
          {rankName(profile?.currentRankId ?? null) ?? t('common.notSet')}
        </Text>
        <View style={styles.heroNext}>
          <Ionicons
            name={atTopRank ? 'trophy' : I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'}
            size={14}
            color="#FFFFFFCC"
          />
          <Text style={styles.heroNextText} numberOfLines={1}>
            {atTopRank ? t('career.topRank') : `${t('dashboard.nextRank')}: ${rankName(nextId) ?? t('common.notSet')}`}
          </Text>
        </View>
      </HeroCard>

      <Card>
        <SectionHeader icon="water" color={colors.primary} title={t('seaTime.title')} />
        {atTopRank ? (
          <View style={styles.topRank}>
            <Ionicons name="trophy" size={22} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: '700', flex: 1 }}>{t('career.topRank')}</Text>
            <Text style={[styles.bigValue, { color: colors.text }]}>
              {seaTime?.total.days ?? 0} <Text style={[styles.unit, { color: colors.textMuted }]}>{t('common.days')}</Text>
            </Text>
          </View>
        ) : (
          <View style={styles.seaRow}>
            <Ring
              progress={progress.progress}
              color={progress.complete ? colors.success : colors.primary}
              track={colors.surfaceMuted}
              label={`${Math.round(progress.progress * 100)}%`}
              textColor={colors.text}
            />
            <View style={{ flex: 1, gap: Spacing.sm }}>
              <StatLine
                label={t('career.completed')}
                value={`${completedByRank?.days ?? 0} / ${required}`}
                unit={t('common.days')}
              />
              <StatLine label={t('career.remaining')} value={`${progress.remaining}`} unit={t('common.days')} />
              <StatLine label={t('seaTime.total')} value={`${seaTime?.total.days ?? 0}`} unit={t('common.days')} />
            </View>
          </View>
        )}
        {!atTopRank && estimated ? (
          <View style={[styles.footNote, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="flag" size={14} color={colors.primary} />
            <Text style={[styles.footNoteText, { color: colors.primary }]}>
              {t('career.estimatedDate')}: {formatDate(estimated)}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card
        onPress={
          shownContract
            ? () => router.push({ pathname: '/contract-detail', params: { id: shownContract.id } })
            : undefined
        }
      >
        <SectionHeader
          icon="boat"
          color={colors.primary}
          title={!activeContract && upcomingContract ? t('dashboard.upcomingContract') : t('dashboard.currentContract')}
          trailing={
            activeContract && countdown ? (
              <Chip color={contractProgressColor(colors, countdown)}>
                {`${countdown.remainingDays} ${t('common.days')}`}
              </Chip>
            ) : upcomingContract ? (
              <Chip color={colors.warning}>
                {daysUntilStart(upcomingContract) <= 1
                  ? t('contracts.startsTomorrow')
                  : t('contracts.startsIn', { days: daysUntilStart(upcomingContract) })}
              </Chip>
            ) : null
          }
        />
        {shownContract ? (
          <>
            <Text style={[styles.vessel, { color: colors.text }]} numberOfLines={1}>
              {shownContract.vesselName ?? '—'}
            </Text>
            <Text style={[styles.subtle, { color: colors.textMuted }]} numberOfLines={1}>
              {shownContract.rankName ?? '—'}
              {!activeContract ? ` · ${t('contracts.planned')}` : ''}
            </Text>
            <View style={styles.tiles}>
              <Tile icon="airplane" label={t('dashboard.joinDate')} value={formatDate(shownContract.joinDate)} />
              <Tile icon="flag" label={t('dashboard.signOff')} value={formatDate(shownContract.expectedSignOff)} />
            </View>
            {activeContract && countdown ? (
              <>
                <ProgressBar progress={countdown.progress} color={contractProgressColor(colors, countdown)} />
                {unusedLeave > 0 ? (
                  <Text style={[styles.subtle, { color: colors.textMuted, marginTop: 6 }]}>
                    {t('dashboard.unusedLeave')}: {unusedLeave} {t('common.days')}
                  </Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <EmptyState title={t('dashboard.noActiveContract')} />
        )}
      </Card>

      {onLeave && returnDate ? (
        <Card>
          <SectionHeader icon="sunny" color={colors.success} title={t('dashboard.leave')} />
          <View style={styles.tiles}>
            <Tile icon="calendar" label={t('dashboard.unusedLeave')} value={`${unusedLeave} ${t('common.days')}`} />
            <Tile icon="return-down-back" label={t('dashboard.expectedReturn')} value={formatDate(returnDate)} />
            <Tile icon="hourglass" label={t('dashboard.daysRemaining')} value={`${daysUntilReturn(returnDate)}`} />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader icon="documents" color={colors.primary} title={t('dashboard.documents')} />
        <View style={styles.tiles}>
          <DocStat value={docStats.valid} label={t('dashboard.valid')} color={colors.success} bg={colors.successMuted} />
          <DocStat value={nearExpiry} label={t('dashboard.expiringSoon')} color={colors.warning} bg={colors.warningMuted} />
          <DocStat value={docStats.expired} label={t('dashboard.expired')} color={colors.danger} bg={colors.dangerMuted} />
        </View>
      </Card>

      {alerts.length > 0 || reminders.length > 0 ? (
        <Card>
          <SectionHeader icon="notifications" color={colors.warning} title={t('dashboard.alerts')} />
          <View style={{ gap: Spacing.sm }}>
            {alerts.map((a, i) => (
              <View key={i} style={[styles.alertRow, { backgroundColor: `${toneColor[a.tone]}14` }]}>
                <Ionicons name={toneIcon[a.tone]} size={16} color={toneColor[a.tone]} />
                <Text style={[styles.alertText, { color: colors.text }]} numberOfLines={2}>
                  {a.text}
                </Text>
              </View>
            ))}
            {reminders.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => router.push({ pathname: '/calendar', params: { note: n.id } })}
                android_ripple={{ color: colors.surfaceMuted }}
                style={[styles.alertRow, { backgroundColor: colors.infoMuted }]}
              >
                <Ionicons name="notifications" size={16} color={colors.info} />
                <Text style={[styles.alertText, { color: colors.text }]} numberOfLines={1}>
                  {n.text}
                </Text>
                <Text style={[styles.reminderWhen, { color: colors.info }]}>
                  {formatDate(n.date)} · {n.time}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** Ocean-gradient card at the top: status and rank. */
function HeroCard({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const ocean = useOcean();
  const id = `hero-${useId().replace(/:/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const wave = `M0,${h - 22} C${w * 0.3},${h - 42} ${w * 0.55},${h - 4} ${w * 0.8},${h - 20} S${w},${h - 26} ${w},${h - 26} L${w},${h} L0,${h} Z`;
  return (
    <View style={styles.hero} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ocean.deep} />
              <Stop offset="1" stopColor="#0096C7" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
          <Circle cx={w * 0.92} cy={h * 0.12} r={h * 0.55} fill="#FFFFFF" opacity={0.06} />
          <Path d={wave} fill="#FFFFFF" opacity={0.08} />
        </Svg>
      ) : null}
      <View style={styles.heroRow}>
        <View style={styles.heroBody}>{children}</View>
        {aside ? <View style={styles.heroAside}>{aside}</View> : null}
      </View>
    </View>
  );
}

function SectionHeader({
  icon,
  color,
  title,
  trailing,
}: {
  icon: IconName;
  color: string;
  title: string;
  trailing?: ReactNode;
}) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

function Chip({ color, children }: { color: string; children: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.chipText, { color }]}>{children}</Text>
    </View>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={13} color={colors.textMuted} />
        <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DocStat({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.docStat, { backgroundColor: bg }]}>
      <Text style={[styles.docValue, { color }]}>{value}</Text>
      <Text style={[styles.docLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatLine({ label, value, unit }: { label: string; value: string; unit: string }) {
  const colors = useTheme();
  return (
    <View style={styles.statLine}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.text }]}>
        {value} <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
      </Text>
    </View>
  );
}

function Ring({
  progress,
  color,
  track,
  label,
  textColor,
  size = 88,
}: {
  progress: number;
  color: string;
  track: string;
  label: string;
  textColor: string;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - fraction)}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringText, { color: textColor }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  greeting: { fontSize: 24, fontWeight: '800' },
  today: { fontSize: 13, fontWeight: '500' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cta: { marginTop: Spacing.sm },
  hero: { borderRadius: 22, overflow: 'hidden', minHeight: 150 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroBody: { flex: 1, padding: Spacing.lg, paddingBottom: Spacing.xl, gap: 4 },
  heroAside: { paddingEnd: Spacing.xl, paddingStart: Spacing.sm },
  heroTop: { flexDirection: 'row', marginBottom: Spacing.sm },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF2E',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  heroLabel: { color: '#FFFFFFB3', fontSize: 12, fontWeight: '600' },
  heroRank: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroNext: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroNextText: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  chip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '800' },
  seaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 18, fontWeight: '800' },
  statLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  statLabel: { fontSize: 13, flexShrink: 1 },
  statValue: { fontSize: 15, fontWeight: '800' },
  unit: { fontSize: 11, fontWeight: '600' },
  bigValue: { fontSize: 18, fontWeight: '800' },
  topRank: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  footNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: Spacing.md,
  },
  footNoteText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  vessel: { fontSize: 18, fontWeight: '800' },
  subtle: { fontSize: 13, fontWeight: '500' },
  tiles: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  tile: { flex: 1, borderRadius: Radius.md, padding: Spacing.sm + 2, gap: 4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  tileValue: { fontSize: 14, fontWeight: '800' },
  docStat: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', gap: 2 },
  docValue: { fontSize: 24, fontWeight: '800' },
  docLabel: { fontSize: 12, fontWeight: '700' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  alertText: { flex: 1, fontSize: 14, fontWeight: '600' },
  reminderWhen: { fontSize: 12, fontWeight: '700' },
});

export default withTabStrip(DashboardScreen, 0);
