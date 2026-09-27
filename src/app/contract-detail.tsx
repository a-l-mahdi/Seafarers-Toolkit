import { useEffect, useId, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  ZoomIn,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { DatePickerField } from '@/components/ui/date-picker';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import { Epaulette } from '@/components/epaulette';
import {
  useChecklistItems,
  useContracts,
  useDocuments,
  useLeaveSettings,
  useMarkContractNotificationsRead,
  useRanks,
  useTripChecklist,
  useTripFiles,
  useVessels,
} from '@/hooks/queries';
import { useChecklistLabel } from '@/components/checklist';
import { buildChecklistTree, checklistProgress, type ChecklistColumn } from '@/domain/checklist';
import type { TripFileKind } from '@/database/repositories/trip-files-repository';
import { useFormattedDate } from '@/hooks/use-date-format';
import { contractCountdown, contractPhase, contractProgressColor, daysUntilStart } from '@/domain/contract';
import { contractFinance, projectSignOff, formatMoney } from '@/domain/contract-finance';
import { earnedLeaveDays } from '@/domain/leave';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDaysISO, isISODate, todayISO } from '@/utils/date';
import { Radius, Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';
import type { LeaveSettings, Vessel } from '@/types/domain';
import { CountryFlag } from '@/components/country-picker';
import { countryLabel, resolveCountry } from '@/domain/countries';

export default function ContractDetailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { id, reminder } = useLocalSearchParams<{ id?: string; reminder?: string }>();
  const { data: contracts } = useContracts();
  const contract = contracts?.find((c) => c.id === id) ?? null;
  // Opened from a trip reminder: show the "don't forget your things" popup once.
  const [reminderOpen, setReminderOpen] = useState(reminder === 'departure' || reminder === 'return');
  const markRead = useMarkContractNotificationsRead();
  useEffect(() => {
    if (id && reminder) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reminder]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={contract?.vesselName ?? t('contracts.title')}
        onBack={() => router.back()}
        actions={
          contract
            ? [
                {
                  icon: 'pencil',
                  label: t('common.edit'),
                  color: colors.primary,
                  onPress: () => router.push(`/contract-form?id=${contract.id}`),
                },
              ]
            : []
        }
      />
      {contract ? <ContractBody contract={contract} /> : <EmptyState title={t('contracts.notFound')} />}
      {contract && !contract.actualSignOff ? (
        <TripReminderModal
          visible={reminderOpen}
          reminder={reminder === 'return' ? 'return' : 'departure'}
          contract={contract}
          onClose={() => setReminderOpen(false)}
          onOpenChecklist={() => {
            setReminderOpen(false);
            router.push({ pathname: '/trip-checklist', params: { id: contract.id } });
          }}
        />
      ) : null}
    </View>
  );
}

/** Popup shown when a trip reminder is opened: a nudge and a way into the checklist. */
function TripReminderModal({
  visible,
  reminder,
  contract,
  onClose,
  onOpenChecklist,
}: {
  visible: boolean;
  reminder: 'departure' | 'return';
  contract: ContractListRow;
  onClose: () => void;
  onOpenChecklist: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const formatDate = useFormattedDate();
  const isReturn = reminder === 'return';
  const vessel = contract.vesselName ?? '—';
  const date = formatDate(isReturn ? contract.expectedSignOff : contract.joinDate);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.popup, { backgroundColor: colors.surface }]}>
          <View style={[styles.popupBand, { backgroundColor: ocean.main }]}>
            <Animated.View entering={ZoomIn.delay(120).duration(260)} style={styles.popupIcon}>
              <Ionicons name={isReturn ? 'home' : 'bag-handle'} size={30} color={ocean.main} />
            </Animated.View>
          </View>
          <View style={styles.popupBody}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>
              {t(isReturn ? 'checklist.reminder.returnTitle' : 'checklist.reminder.departureTitle')}
            </Text>
            <Text style={[styles.popupText, { color: colors.textMuted }]}>
              {t(isReturn ? 'checklist.reminder.returnBody' : 'checklist.reminder.departureBody', { vessel, date })}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenChecklist}
              style={({ pressed }) => [styles.popupBtn, { backgroundColor: ocean.main, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />
              <Text style={styles.popupBtnText}>{t('checklist.open')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={styles.popupLater}>
              <Text style={[styles.popupLaterText, { color: colors.textMuted }]}>{t('checklist.later')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The trip's packing checklist: live from the day the contract is added until sign-off. */
function ChecklistCard({ contract }: { contract: ContractListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const router = useRouter();
  const labelOf = useChecklistLabel();
  const { data: items } = useChecklistItems();
  const { data: documents } = useDocuments();
  const { data: marks } = useTripChecklist(contract.id);
  const nodes = buildChecklistTree(
    items ?? [],
    (documents ?? []).map((d) => ({ id: d.id, name: d.name })),
    marks ?? [],
    labelOf,
  );
  const columns: ChecklistColumn[] = contractPhase(contract) === 'upcoming' ? ['out'] : ['out', 'back'];

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip-checklist', params: { id: contract.id } })}
      android_ripple={{ color: ocean.soft }}
      style={[styles.checkCard, { backgroundColor: ocean.mist, borderColor: ocean.line }]}
    >
      <View style={[styles.checkIcon, { backgroundColor: ocean.main }]}>
        <Ionicons name="checkbox" size={20} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[styles.checkTitle, { color: colors.text }]}>{t('checklist.title')}</Text>
        {columns.map((col) => {
          const p = checklistProgress(nodes, col);
          const pct = p.total > 0 ? p.done / p.total : 0;
          return (
            <View key={col} style={styles.checkLine}>
              <Ionicons name={col === 'out' ? 'airplane' : 'home'} size={13} color={ocean.main} />
              <View style={[styles.checkTrack, { backgroundColor: colors.surface }]}>
                <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ocean.main }]} />
              </View>
              <Text style={[styles.checkCount, { color: ocean.main }]}>
                {t('checklist.progress', { done: p.done, total: p.total })}
              </Text>
            </View>
          );
        })}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

type IconName = keyof typeof Ionicons.glyphMap;

/** Card title with a tinted icon badge (the home screen's section style). */
function SectionHeader({ icon, color, title }: { icon: IconName; color: string; title: string }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

/** A labelled progress bar (fraction 0..1). */
function Bar({
  icon,
  label,
  detail,
  fraction,
  color,
  track,
}: {
  icon: IconName;
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
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.barLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.barDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`, backgroundColor: color },
          ]}
        />
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
    (files ?? []).filter((f) => f.kind === kind).map((f) => ({ id: f.id, uri: f.localPath, name: f.fileName }));

  if ((files ?? []).length === 0) return null;

  return (
    <Card>
      <SectionHeader icon="folder-open" color={colors.primary} title={t('contractDetail.documents')} />
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
function Stat({ icon, label, value, hint }: { icon: IconName; label: string; value: string; hint?: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={13} color={colors.textMuted} />
        <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text style={[styles.statHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Ocean-gradient header card: vessel, rank, status and the voyage track. */
function VoyageHero({ contract, vessel }: { contract: ContractListRow; vessel: Vessel | null }) {
  const { t, i18n } = useTranslation();
  const ocean = useOcean();
  const formatDate = useFormattedDate();
  const { data: ranks } = useRanks();
  const insignia = ranks?.find((r) => r.id === contract.rankId)?.insignia ?? null;
  const gid = `voyage-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  const cd = contractCountdown(contract);
  const phase = contractPhase(contract);
  const endDate = contract.actualSignOff ?? contract.expectedSignOff;
  const pct = Math.round(Math.min(Math.max(cd.progress, 0), 1) * 100);
  const status: { label: string; icon: IconName } =
    phase === 'active'
      ? { label: t('contracts.active'), icon: 'boat' }
      : phase === 'upcoming'
        ? { label: t('contracts.planned'), icon: 'time' }
        : { label: t('contracts.completed'), icon: 'checkmark-circle' };
  const sub = [vessel?.type, countryLabel(vessel?.flag, i18n.language)].filter(Boolean).join(' · ');
  const flagCode = resolveCountry(vessel?.flag)?.code;
  const wave = `M0,${h - 26} C${w * 0.3},${h - 48} ${w * 0.55},${h - 6} ${w * 0.8},${h - 22} S${w},${h - 30} ${w},${h - 30} L${w},${h} L0,${h} Z`;
  const toStart = daysUntilStart(contract);

  const figures: { value: string; label: string }[] =
    phase === 'upcoming'
      ? [
          { value: String(Math.max(toStart, 0)), label: t('contractDetail.toJoin') },
          { value: String(cd.totalDays), label: t('contractDetail.totalDays') },
        ]
      : phase === 'active'
        ? [
            { value: String(cd.elapsedDays), label: t('contractDetail.onboard') },
            { value: String(cd.remainingDays), label: t('dashboard.remaining') },
            { value: String(cd.totalDays), label: t('contractDetail.totalDays') },
          ]
        : [{ value: String(cd.totalDays), label: t('contractDetail.totalDays') }];

  return (
    <View
      style={styles.hero}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {w > 0 ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ocean.deep} />
              <Stop offset="1" stopColor="#0096C7" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${gid})`} />
          <Circle cx={w * 0.9} cy={h * 0.1} r={h * 0.5} fill="#FFFFFF" opacity={0.06} />
          <Path d={wave} fill="#FFFFFF" opacity={0.08} />
        </Svg>
      ) : null}

      <View style={styles.heroBody}>
        <View style={styles.heroTop}>
          <View style={styles.pill}>
            <Ionicons name={status.icon} size={13} color="#FFFFFF" />
            <Text style={styles.pillText}>{status.label}</Text>
          </View>
          {contract.rankName ? (
            <View style={styles.pill}>
              {insignia ? (
                <Epaulette insignia={insignia} size={22} />
              ) : (
                <Ionicons name="person" size={13} color="#FFFFFF" />
              )}
              <Text style={styles.pillText} numberOfLines={1}>
                {contract.rankName}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.heroVessel} numberOfLines={1}>
          {contract.vesselName ?? '—'}
        </Text>
        {sub ? (
          <View style={styles.heroSubRow}>
            {flagCode ? <CountryFlag code={flagCode} width={21} /> : null}
            <Text style={[styles.heroSub, { flexShrink: 1 }]} numberOfLines={1}>
              {sub}
            </Text>
          </View>
        ) : null}

        {/* Voyage track: join → sign-off, the ship sailing along it. */}
        <View style={styles.trackWrap}>
          <View style={styles.trackLine}>
            <View style={[styles.trackFill, { width: `${pct}%` }]} />
          </View>
          <View style={[styles.shipMarker, { start: `${pct}%` }]}>
            <Ionicons name="boat" size={14} color={ocean.deep} />
          </View>
        </View>
        <View style={styles.trackEnds}>
          <View style={styles.trackEnd}>
            <Ionicons name="log-in-outline" size={13} color="#FFFFFFB3" />
            <Text style={styles.trackDate}>{formatDate(contract.joinDate)}</Text>
          </View>
          <View style={styles.trackEnd}>
            <Text style={styles.trackDate}>{formatDate(endDate)}</Text>
            <Ionicons name="home-outline" size={13} color="#FFFFFFB3" />
          </View>
        </View>

        <View style={styles.figures}>
          {figures.map((f) => (
            <View key={f.label} style={styles.figure}>
              <Text style={styles.figureValue}>{f.value}</Text>
              <Text style={styles.figureLabel} numberOfLines={1}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** The vessel's particulars as small tiles (only the ones filled in). */
function VesselCard({ vessel }: { vessel: Vessel }) {
  const { t, i18n } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const flagCode = resolveCountry(vessel.flag)?.code;
  const all: { icon: IconName; label: string; value: string | null; flag?: string }[] = [
    { icon: 'barcode-outline', label: t('vessels.imo'), value: vessel.imo },
    { icon: 'boat-outline', label: t('vessels.type'), value: vessel.type },
    {
      icon: 'flag-outline',
      label: t('vessels.flag'),
      value: countryLabel(vessel.flag, i18n.language),
      flag: flagCode,
    },
    { icon: 'cube-outline', label: 'GT', value: vessel.grossTonnage != null ? String(vessel.grossTonnage) : null },
    { icon: 'cube-outline', label: 'NT', value: vessel.netTonnage != null ? String(vessel.netTonnage) : null },
    { icon: 'business-outline', label: t('vessels.owner'), value: vessel.owner },
    { icon: 'briefcase-outline', label: t('vessels.management'), value: vessel.managementCompany },
  ];
  const items = all.filter((i) => i.value);
  if (items.length === 0) return null;
  return (
    <Card>
      <SectionHeader icon="boat" color={ocean.main} title={t('contractDetail.vessel')} />
      <View style={styles.statGrid}>
        {items.map((i) => (
          <View key={i.label} style={[styles.vesselTile, { backgroundColor: colors.surfaceMuted }]}>
            <View style={styles.statHead}>
              <Ionicons name={i.icon} size={13} color={colors.textMuted} />
              <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {i.label}
              </Text>
            </View>
            <View style={styles.vesselValueRow}>
              {i.flag ? <CountryFlag code={i.flag} width={24} /> : null}
              <Text style={[styles.vesselValue, { color: colors.text, flexShrink: 1 }]} numberOfLines={2}>
                {i.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ContractBody({ contract }: { contract: ContractListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const formatDate = useFormattedDate();
  const { width } = useWindowDimensions();
  const { data: vessels } = useVessels();
  const vessel = vessels?.find((v) => v.id === contract.vesselId) ?? null;
  const photo = vessel?.photoPath ?? null;
  const { data: leaveSettings } = useLeaveSettings();
  const settings: LeaveSettings = leaveSettings ?? {
    mode: 'ratio',
    onboardDays: 120,
    leaveDays: 60,
    manualLeaveStartDate: null,
    manualLeaveEndDate: null,
  };

  const cd = contractCountdown(contract);
  const fin = contractFinance(contract);
  const endDate = contract.actualSignOff ?? contract.expectedSignOff;
  const phase = contractPhase(contract);
  const isActive = phase === 'active';
  const isUpcoming = phase === 'upcoming';
  const toStart = daysUntilStart(contract);

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

  // Vessel cover: slides up at half speed and fades as the page scrolls over it,
  // stretches when pulled down, and comes back on the way up.
  const coverH = Math.round((width * 9) / 16) + insets.top;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const coverStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, coverH * 0.8], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-coverH, 0, coverH],
          [-coverH / 2, 0, -coverH / 2],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(scrollY.value, [-coverH, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <>
      {photo ? (
        <Animated.View style={[styles.cover, { height: coverH }, coverStyle]} pointerEvents="none">
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="coverShade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.35" />
                <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
                <Stop offset="0.75" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.3" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#coverShade)" />
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.xxl + insets.bottom }}
      >
        {photo ? <View style={{ height: coverH - 24 }} /> : null}
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingTop: photo ? Spacing.lg : headerPad },
            photo ? styles.sheetOverCover : null,
          ]}
        >
          <VoyageHero contract={contract} vessel={vessel} />

          {!contract.actualSignOff ? <ChecklistCard contract={contract} /> : null}

          {/* Progress bars */}
          <Card>
            <SectionHeader icon="analytics" color={colors.primary} title={t('contractDetail.progress')} />
            <Bar
              icon="boat-outline"
              label={t('contractDetail.onboard')}
              detail={`${cd.elapsedDays} / ${cd.totalDays} ${t('common.days')}`}
              fraction={cd.progress}
              color={contractProgressColor(colors, cd)}
              track={colors.surfaceMuted}
            />
            <Bar
              icon="sunny-outline"
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
            {isUpcoming ? (
              <Text style={[styles.remaining, { color: colors.primary, fontWeight: '700' }]}>
                {toStart <= 1 ? t('contracts.startsTomorrow') : t('contracts.startsIn', { days: toStart })}
              </Text>
            ) : null}
            <View style={[styles.leaveInfo, { backgroundColor: colors.successMuted }]}>
              <View style={[styles.leaveIcon, { backgroundColor: colors.success }]}>
                <Ionicons name="sunny" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.leaveInfoLabel, { color: colors.text }]}>
                  {isActive ? t('contractDetail.leaveToday') : t('contractDetail.leaveTotalLabel')}
                </Text>
                <Text style={[styles.leaveInfoValue, { color: colors.success }]}>
                  {leaveDaysShown} {t('common.days')} · {t('contractDetail.until')} {formatDate(leaveUntilISO)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Wages */}
          <Card>
            <SectionHeader icon="cash" color={colors.success} title={t('contractDetail.wages')} />
            {fin.hasWage ? (
              <>
                <View style={styles.statGrid}>
                  {isActive ? (
                    <Stat
                      icon="trending-up"
                      label={t('contractDetail.earnedToDate')}
                      value={formatMoney(fin.earnedToDate, currency)}
                      hint={`${cd.elapsedDays} ${t('common.days')}`}
                    />
                  ) : null}
                  <Stat
                    icon="flag-outline"
                    label={t('contractDetail.earnedFull')}
                    value={formatMoney(fin.earnedFullContract, currency)}
                    hint={`${cd.totalDays} ${t('common.days')}`}
                  />
                  <Stat
                    icon="today-outline"
                    label={t('contractDetail.dailyRate')}
                    value={formatMoney(fin.dailyRate, currency)}
                  />
                </View>
                {fin.travelDays > 0 ? (
                  <View style={[styles.travel, { borderColor: colors.border }]}>
                    <View style={styles.statHead}>
                      <Ionicons name="airplane-outline" size={14} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                        {t('contractDetail.travel', { days: fin.travelDays })}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      + {formatMoney(fin.travelPay, currency)}
                    </Text>
                  </View>
                ) : null}
                {fin.bonus > 0 ? (
                  <View style={[styles.travel, { borderColor: colors.border }]}>
                    <View style={styles.statHead}>
                      <Ionicons name="gift-outline" size={14} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('contractDetail.bonus')}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      + {formatMoney(fin.bonus, currency)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.total, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '600', opacity: 0.9 }}>
                    {t('contractDetail.totalWithTravel')}
                  </Text>
                  <Text style={{ color: colors.onPrimary, fontSize: 19, fontWeight: '800' }}>
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
              <SectionHeader icon="calculator" color={colors.warning} title={t('contractDetail.projectionTitle')} />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.sm }}>
                {t('contractDetail.projectionHint')}
              </Text>
              <DatePickerField label={t('contractDetail.signOffOn')} value={projDate} onChange={setProjDate} />
              {proj ? (
                <View style={styles.statGrid}>
                  <Stat
                    icon="boat-outline"
                    label={t('contractDetail.projDays')}
                    value={`${proj.days} ${t('common.days')}`}
                  />
                  <Stat
                    icon="sunny-outline"
                    label={t('contractDetail.projLeave')}
                    value={`${proj.leaveDays} ${t('common.days')}`}
                  />
                  {fin.hasWage ? (
                    <Stat
                      icon="cash-outline"
                      label={t('contractDetail.projWage')}
                      value={formatMoney(proj.wage, currency)}
                      hint={fin.travelDays > 0 ? t('contractDetail.inclTravel') : undefined}
                    />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ) : null}

          {vessel ? <VesselCard vessel={vessel} /> : null}

          {/* Contract documents (contract copy / sea service report / final wages) */}
          <ContractDocsCard contractId={contract.id} />
        </View>
      </Animated.ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  sheetOverCover: { borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: 600 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  backdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.xl },
  popup: { borderRadius: 24, overflow: 'hidden' },
  popupBand: { height: 92, alignItems: 'center', justifyContent: 'flex-end' },
  popupIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -34,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  popupBody: { padding: Spacing.lg, paddingTop: 34 + Spacing.md, alignItems: 'center', gap: Spacing.sm },
  popupTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  popupText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  popupBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.md,
    paddingVertical: 13,
    marginTop: Spacing.sm,
  },
  popupBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  popupLater: { paddingVertical: Spacing.xs },
  popupLaterText: { fontSize: 14, fontWeight: '600' },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  checkIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  checkTitle: { fontSize: 15, fontWeight: '700' },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  checkCount: { fontSize: 11, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  hero: { borderRadius: 22, overflow: 'hidden' },
  heroBody: { padding: Spacing.lg, gap: 4 },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF26',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    height: 28,
    maxWidth: '100%',
  },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  heroVessel: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroSub: { color: '#FFFFFFB3', fontSize: 13, fontWeight: '600' },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  trackWrap: { height: 26, justifyContent: 'center', marginTop: Spacing.md, marginHorizontal: 12 },
  trackLine: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF40', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: '#FFFFFF' },
  shipMarker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    marginStart: -13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  trackEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackEnd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trackDate: { color: '#FFFFFFE6', fontSize: 12, fontWeight: '600' },
  figures: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  figure: {
    flex: 1,
    backgroundColor: '#FFFFFF1F',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  figureValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  figureLabel: { color: '#FFFFFFB3', fontSize: 11, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  docGroup: { marginBottom: Spacing.md, gap: Spacing.xs },
  docGroupTitle: { fontSize: 13, fontWeight: '600' },
  barBlock: { marginBottom: Spacing.md },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  barLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  barDetail: { fontSize: 12 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  remaining: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  leaveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  leaveIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  leaveInfoLabel: { fontSize: 13, fontWeight: '600' },
  leaveInfoValue: { fontSize: 14, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexGrow: 1, flexBasis: '46%', borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { fontSize: 12, flexShrink: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statHint: { fontSize: 11 },
  vesselTile: { flexGrow: 1, flexBasis: '46%', borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  vesselValue: { fontSize: 15, fontWeight: '700' },
  vesselValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
