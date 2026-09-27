import { useId, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import {
  BarChart,
  DonutChart,
  DotChart,
  LegendRow,
  RingProgress,
  StackedBar,
  type Slice,
} from '@/components/report-charts';
import {
  useContracts,
  useDocuments,
  useLeaveSettings,
  useProfile,
  useRanks,
  useSeaTimeSummary,
  type ContractListRow,
} from '@/hooks/queries';
import { contractCountdown, contractPhase } from '@/domain/contract';
import { contractFinance, formatMoney } from '@/domain/contract-finance';
import {
  careerProgress,
  estimatedQualificationDate,
  isTopRank,
  promotionDaysFromMonths,
  resolveNextRankId,
} from '@/domain/career';
import { computeLeaveLedger } from '@/domain/leave';
import { buildRankColorMap } from '@/domain/rank-color';
import { atSeaShare, earningsByCurrency, seaDaysByYear, splitDuration } from '@/domain/reports';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/store/settings-store';
import { Radius, Spacing } from '@/constants/theme';
import { BRAND } from '@/components/settings-art';

type IconName = keyof typeof Ionicons.glyphMap;

const UNRANKED_COLOR = '#94A3B8';
// One family of ocean blues (the app icon's), deep → light.
const WAGE_COLOR = BRAND.main;
const TRAVEL_COLOR = BRAND.bright;
const BONUS_COLOR = BRAND.light;

const num = (n: number) => Math.round(n).toLocaleString('en-US');

export default function ReportsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const router = useRouter();
  const { data: contracts } = useContracts();

  const list = contracts ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader title={t('reports.title')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom },
        ]}
      >
        <Hero contracts={list} />
        {list.length ? (
          <>
            <QuickStats contracts={list} />
            <EarningsCard contracts={list} />
            <RankCard />
            <YearCard contracts={list} />
            <CareerCard contracts={list} />
          </>
        ) : contracts ? (
          <Card>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{t('reports.noData')}</Text>
          </Card>
        ) : null}
        <DocumentsCard />
        {list.length ? <HistoryCard contracts={list} /> : null}
      </ScrollView>
    </View>
  );
}

/** Staggered fade-in for the page's blocks. */
function Reveal({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={FadeInDown.delay(60 * index).duration(380)}>{children}</Animated.View>;
}

function SectionTitle({
  icon,
  title,
  color,
  right,
}: {
  icon: IconName;
  title: string;
  color: string;
  right?: ReactNode;
}) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

// ─── Hero: total sea time ──────────────────────────────────────────────────────

function Hero({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const ocean = useOcean();
  const { data: seaTime } = useSeaTimeSummary();
  const gid = `hero-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });

  const total = seaTime?.total.days ?? 0;
  const parts = splitDuration(total);
  const vessels = new Set(contracts.map((c) => c.vesselId)).size;
  const share = Math.round(atSeaShare(contracts) * 100);

  return (
    <Reveal index={0}>
      <View
        style={styles.hero}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {size.w > 0 ? (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={ocean.bright} />
                <Stop offset="1" stopColor={ocean.deep} />
              </LinearGradient>
            </Defs>
            <Rect width={size.w} height={size.h} fill={`url(#${gid})`} />
            <Circle cx={size.w * 0.92} cy={size.h * 0.08} r={size.h * 0.55} fill="#FFFFFF" opacity={0.08} />
            <Circle cx={size.w * 0.05} cy={size.h * 1.05} r={size.h * 0.45} fill="#FFFFFF" opacity={0.06} />
          </Svg>
        ) : null}
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>{t('reports.totalSeaTime')}</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{num(total)}</Text>
              <Text style={styles.heroUnit}>{t('common.days')}</Text>
            </View>
            <Text style={styles.heroSplit}>
              {parts.years} {t('reports.years')} · {parts.months} {t('reports.months')} · {parts.days} {t('common.day')}
            </Text>
          </View>
          <MaterialCommunityIcons name="ferry" size={46} color="#FFFFFFD0" />
        </View>
        <View style={styles.heroPills}>
          <HeroPill icon="document-text" value={String(contracts.length)} label={t('reports.trips')} />
          <HeroPill icon="boat" value={String(vessels)} label={t('reports.vessels')} />
          <HeroPill icon="water" value={`${share}%`} label={t('reports.atSea')} />
        </View>
      </View>
    </Reveal>
  );
}

function HeroPill({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.heroPill}>
      <Ionicons name={icon} size={15} color="#FFFFFF" />
      <Text style={styles.heroPillValue}>{value}</Text>
      <Text style={styles.heroPillLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ─── Quick stats ──────────────────────────────────────────────────────────────

function QuickStats({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: leaveSettings } = useLeaveSettings();
  const started = contracts.filter((c) => contractPhase(c) !== 'upcoming');
  const lengths = started.map((c) => contractCountdown(c).totalDays);
  const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const longest = lengths.length ? Math.max(...lengths) : 0;
  const leave = leaveSettings ? computeLeaveLedger(contracts, leaveSettings).unusedNow : null;

  const tiles: { icon: IconName; color: string; value: string; label: string }[] = [
    { icon: 'sunny', color: colors.primary, value: leave != null ? num(leave) : '—', label: t('reports.unusedLeave') },
    { icon: 'time', color: colors.primary, value: num(avg), label: t('reports.avgTrip') },
    { icon: 'trophy', color: colors.primary, value: num(longest), label: t('reports.longestTrip') },
  ];
  return (
    <Reveal index={1}>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.tileIcon, { backgroundColor: `${tile.color}1F` }]}>
              <Ionicons name={tile.icon} size={17} color={tile.color} />
            </View>
            <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {tile.value}
              <Text style={[styles.tileUnit, { color: colors.textMuted }]}> {t('common.days')}</Text>
            </Text>
            <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>
    </Reveal>
  );
}

// ─── Earnings ─────────────────────────────────────────────────────────────────

function EarningsCard({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const [mode, setMode] = useState<'total' | 'wage'>('total');
  const all = useMemo(() => earningsByCurrency(contracts), [contracts]);
  const main = all[0];
  if (!main) return null;

  const paid = contracts
    .filter((c) => contractFinance(c).hasWage && contractFinance(c).currency === main.currency)
    .sort((a, b) => (a.joinDate < b.joinDate ? -1 : 1));
  const wages = paid.map((c) => c.monthlyWage ?? 0).filter((w) => w > 0);
  const avgWage = wages.length ? wages.reduce((a, b) => a + b, 0) / wages.length : 0;
  const topWage = wages.length ? Math.max(...wages) : 0;
  const earnedPct = main.total > 0 ? Math.min(main.earned / main.total, 1) : 0;
  const dots = paid
    .map((c) => {
      const fin = contractFinance(c);
      const value = mode === 'total' ? fin.totalWithTravel : fin.monthlyWage;
      return {
        key: c.id,
        value,
        label: formatDate(c.joinDate).slice(2, 7),
        display: formatMoney(value, fin.currency),
        caption: c.vesselName ?? undefined,
      };
    })
    .filter((d) => d.value > 0);
  const parts: (Slice & { label: string })[] = [
    { key: 'wages', value: main.wages, color: WAGE_COLOR, label: t('reports.wages') },
    { key: 'travel', value: main.travel, color: TRAVEL_COLOR, label: t('reports.travel') },
    { key: 'bonus', value: main.bonus, color: BONUS_COLOR, label: t('reports.bonus') },
  ];

  return (
    <Reveal index={2}>
      <Card>
        <SectionTitle icon="wallet" title={t('reports.earnings')} color={colors.primary} />
        <Text style={[styles.muted, { color: colors.textMuted }]}>{t('reports.totalEarnings')}</Text>
        <View style={styles.moneyRow}>
          <Text style={[styles.money, { color: colors.text }]}>{num(main.total)}</Text>
          <Text style={[styles.moneyCurrency, { color: colors.primary }]}>{main.currency}</Text>
        </View>
        {all.slice(1).map((e) => (
          <Text key={e.currency} style={[styles.otherCurrency, { color: colors.text }]}>
            + {formatMoney(e.total, e.currency)}
          </Text>
        ))}

        <View style={styles.earnedBlock}>
          <StackedBar
            parts={[
              { key: 'earned', value: main.earned, color: WAGE_COLOR },
              { key: 'rest', value: Math.max(main.total - main.earned, 0), color: `${WAGE_COLOR}33` },
            ]}
            height={10}
          />
          <View style={styles.earnedRow}>
            <Text style={[styles.small, { color: colors.textMuted }]}>
              {t('reports.earnedSoFar')}:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>{num(main.earned)}</Text> (
              {Math.round(earnedPct * 100)}%)
            </Text>
            {main.total - main.earned > 0 ? (
              <Text style={[styles.small, { color: colors.textMuted }]}>
                {t('reports.toCome')}:{' '}
                <Text style={{ color: colors.text, fontWeight: '700' }}>{num(main.total - main.earned)}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        <StackedBar parts={parts} height={12} />
        <View style={styles.inlineLegend}>
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <View key={p.key} style={styles.inlineLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                <Text style={[styles.small, { color: colors.textMuted }]}>{p.label}</Text>
                <Text style={[styles.small, { color: colors.text, fontWeight: '700' }]}>{num(p.value)}</Text>
              </View>
            ))}
        </View>

        <View style={styles.miniStats}>
          <MiniStat label={t('reports.avgMonthlyWage')} value={formatMoney(avgWage, main.currency)} />
          <View style={[styles.miniDivider, { backgroundColor: colors.border }]} />
          <MiniStat label={t('reports.topMonthlyWage')} value={formatMoney(topWage, main.currency)} />
        </View>

        {dots.length ? (
          <>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { key: 'total', label: t('reports.perContract') },
                { key: 'wage', label: t('reports.monthlyWage') },
              ]}
            />
            <DotChart key={mode} dots={dots} color={WAGE_COLOR} averageLabel={t('reports.average')} />
          </>
        ) : null}
      </Card>
    </Reveal>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[styles.small, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Segmented<K extends string>({
  value,
  onChange,
  options,
}: {
  value: K;
  onChange: (key: K) => void;
  options: { key: K; label: string }[];
}) {
  const colors = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, on && [styles.segmentOn, { backgroundColor: colors.surface }]]}
          >
            <Text style={{ color: on ? colors.text : colors.textMuted, fontSize: 13, fontWeight: on ? '700' : '500' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Sea time by rank (donut) ─────────────────────────────────────────────────

function RankCard() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: ranks } = useRanks();
  const rankColors = useMemo(() => buildRankColorMap(ranks ?? []), [ranks]);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = (seaTime?.byRank ?? []).filter((r) => r.days > 0);
  const total = rows.reduce((sum, r) => sum + r.days, 0);
  if (!rows.length) return null;
  const keyOf = (id: string | null) => id ?? '_none';
  const slices = rows.map((r) => ({
    key: keyOf(r.rankId),
    value: r.days,
    color: (r.rankId && rankColors.get(r.rankId)) || UNRANKED_COLOR,
  }));
  const picked = rows.find((r) => keyOf(r.rankId) === selected) ?? null;
  const toggle = (key: string) => setSelected((s) => (s === key ? null : key));

  return (
    <Reveal index={3}>
      <Card>
        <SectionTitle icon="pie-chart" title={t('reports.seaTimeByRank')} color={colors.primary} />
        <View style={styles.donutWrap}>
          <DonutChart slices={slices} selectedKey={selected} onSelect={toggle}>
            <Text style={[styles.donutValue, { color: colors.text }]}>{num(picked?.days ?? total)}</Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>{t('common.days')}</Text>
            {picked ? (
              <Text style={[styles.donutShare, { color: colors.primary }]}>
                {Math.round((picked.days / total) * 100)}%
              </Text>
            ) : null}
          </DonutChart>
        </View>
        {rows.map((r, i) => (
          <LegendRow
            key={slices[i].key}
            color={slices[i].color}
            label={r.rankName}
            value={`${num(r.days)} ${t('common.days')}`}
            share={`${Math.round((r.days / total) * 100)}%`}
            active={selected === slices[i].key}
            onPress={() => toggle(slices[i].key)}
          />
        ))}
      </Card>
    </Reveal>
  );
}

// ─── Sea days per year (bars) ─────────────────────────────────────────────────

function YearCard({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const ocean = useOcean();
  const calendar = useSettingsStore((s) => s.calendar);
  const years = useMemo(() => seaDaysByYear(contracts, calendar).slice(-8), [contracts, calendar]);
  if (!years.length) return null;
  return (
    <Reveal index={4}>
      <Card>
        <SectionTitle icon="bar-chart" title={t('reports.seaDaysByYear')} color={ocean.main} />
        <BarChart
          color={ocean.main}
          bars={years.map((y) => ({ key: String(y.year), label: String(y.year), value: y.days }))}
        />
      </Card>
    </Reveal>
  );
}

// ─── Career (promotion ring) ──────────────────────────────────────────────────

function CareerCard({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();
  const { data: seaTime } = useSeaTimeSummary();

  const currentId = profile?.currentRankId ?? null;
  const currentRank = ranks?.find((r) => r.id === currentId) ?? null;
  if (!currentRank) return null;
  const top = isTopRank(currentId, ranks ?? []);
  const nextId = resolveNextRankId(currentId, profile?.nextRankId ?? null, ranks ?? []);
  const nextName = ranks?.find((r) => r.id === nextId)?.name ?? null;
  const required = promotionDaysFromMonths(currentRank.promotionMonths ?? null);
  const done = seaTime?.byRank.find((r) => r.rankId === currentId)?.days ?? 0;
  const progress = careerProgress(done, required);
  const running =
    contracts.find((c) => contractPhase(c) === 'active') ??
    [...contracts].reverse().find((c) => contractPhase(c) === 'upcoming') ??
    null;
  const estimated = estimatedQualificationDate(
    progress.remaining,
    running?.joinDate ?? null,
    running?.expectedSignOff ?? null,
  );
  const ringColor = colors.primary;

  return (
    <Reveal index={5}>
      <Card>
        <SectionTitle icon="trending-up" title={t('reports.careerSummary')} color={colors.primary} />
        <View style={styles.careerRow}>
          <RingProgress progress={top ? 1 : progress.progress} color={ringColor} size={118}>
            <Text style={[styles.ringValue, { color: colors.text }]}>
              {top ? '★' : `${Math.round(progress.progress * 100)}%`}
            </Text>
          </RingProgress>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.rankFlow}>
              <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>
                {currentRank.name}
              </Text>
              {!top && nextName ? (
                <>
                  <Ionicons
                    name={I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.rankName, { color: colors.primary }]} numberOfLines={1}>
                    {nextName}
                  </Text>
                </>
              ) : null}
            </View>
            {top ? (
              <Text style={[styles.small, { color: colors.textMuted }]}>{t('career.topRank')}</Text>
            ) : (
              <>
                <Text style={[styles.small, { color: colors.textMuted }]}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{num(done)}</Text>{' '}
                  {t('reports.ofRequired', { count: required })}
                </Text>
                <Text style={[styles.small, { color: colors.textMuted }]}>
                  {t('career.remaining')}:{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {num(progress.remaining)} {t('common.days')}
                  </Text>
                </Text>
                {estimated ? (
                  <Text style={[styles.small, { color: colors.textMuted }]}>
                    {t('career.estimatedDate')}:{' '}
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{formatDate(estimated)}</Text>
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Card>
    </Reveal>
  );
}

// ─── Documents (donut + expiring next) ────────────────────────────────────────

function DocumentsCard() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const formatDate = useFormattedDate();
  const { data: documents } = useDocuments();
  const docs = documents ?? [];
  if (!docs.length) return null;

  const statuses = [
    { key: 'valid', color: BRAND.main },
    { key: 'expiring_soon', color: colors.warning },
    { key: 'not_valid', color: `${colors.warning}99` },
    { key: 'expired', color: colors.danger },
    { key: 'no_expiry', color: BRAND.light },
  ] as const;
  const counts = statuses
    .map((s) => ({ ...s, value: docs.filter((d) => d.status === s.key).length }))
    .filter((s) => s.value > 0);
  const upcoming = docs
    .filter((d) => d.expiryDate && d.daysUntilExpiry != null)
    .sort((a, b) => (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0))
    .slice(0, 4);
  const toneOf = (days: number) => (days < 0 ? colors.danger : days <= 90 ? colors.warning : colors.primary);

  return (
    <Reveal index={6}>
      <Card>
        <SectionTitle icon="folder-open" title={t('reports.documentStatus')} color={colors.primary} />
        <View style={styles.docsTop}>
          <DonutChart slices={counts} size={128} thickness={16}>
            <Text style={[styles.donutValue, { color: colors.text, fontSize: 24 }]}>{docs.length}</Text>
            <Text style={[styles.small, { color: colors.textMuted }]}>{t('reports.documentsTotal')}</Text>
          </DonutChart>
          <View style={{ flex: 1 }}>
            {counts.map((s) => (
              <View key={s.key} style={styles.docLegend}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={[styles.small, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {t(`documents.status.${s.key}`)}
                </Text>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>
        {upcoming.length ? (
          <>
            <Text style={[styles.subTitle, { color: colors.textMuted }]}>{t('reports.nextExpiring')}</Text>
            {upcoming.map((d) => {
              const days = d.daysUntilExpiry ?? 0;
              const tone = toneOf(days);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => router.push({ pathname: '/document-detail', params: { id: d.id } })}
                  style={({ pressed }) => [styles.docRow, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.docBar, { backgroundColor: tone }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[styles.small, { color: colors.textMuted }]}>{formatDate(d.expiryDate)}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: `${tone}1F` }]}>
                    <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>
                      {days < 0 ? t('reports.expiredAgo', { count: -days }) : t('reports.daysLeft', { count: days })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </Card>
    </Reveal>
  );
}

// ─── Contract history ─────────────────────────────────────────────────────────

function HistoryCard({ contracts }: { contracts: ContractListRow[] }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const formatDate = useFormattedDate();
  const { data: ranks } = useRanks();
  const rankColors = useMemo(() => buildRankColorMap(ranks ?? []), [ranks]);
  const sorted = [...contracts].sort((a, b) => (a.joinDate < b.joinDate ? 1 : -1));
  const totals = earningsByCurrency(contracts);

  return (
    <Reveal index={7}>
      <Card>
        <SectionTitle icon="list" title={t('reports.contractHistory')} color={colors.primary} />
        {sorted.map((c) => {
          const fin = contractFinance(c);
          const cd = contractCountdown(c);
          const phase = contractPhase(c);
          const tint = (c.rankId && rankColors.get(c.rankId)) || UNRANKED_COLOR;
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/contract-detail', params: { id: c.id } })}
              style={({ pressed }) => [styles.tripRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.tripRail}>
                <View style={[styles.tripDot, { backgroundColor: tint, borderColor: `${tint}55` }]} />
                <View style={[styles.tripLine, { backgroundColor: colors.border }]} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.tripHead}>
                  <Text style={[styles.tripVessel, { color: colors.text }]} numberOfLines={1}>
                    {c.vesselName ?? '—'}
                  </Text>
                  {phase !== 'completed' ? (
                    <View
                      style={[
                        styles.pill,
                        { backgroundColor: phase === 'active' ? colors.primary : `${colors.primary}1F` },
                      ]}
                    >
                      <Text
                        style={{
                          color: phase === 'active' ? colors.onPrimary : colors.primary,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {phase === 'active' ? t('contracts.active') : t('contracts.planned')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.small, { color: tint, fontWeight: '700' }]} numberOfLines={1}>
                  {c.rankName ?? '—'}
                </Text>
                <Text style={[styles.small, { color: colors.textMuted }]}>
                  {formatDate(c.joinDate)} → {formatDate(c.actualSignOff ?? c.expectedSignOff)} · {cd.totalDays}{' '}
                  {t('common.days')}
                </Text>
              </View>
              {fin.hasWage ? (
                <Text style={[styles.tripMoney, { color: colors.primary }]}>
                  {formatMoney(fin.totalWithTravel, fin.currency)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
        {totals.length ? (
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('reports.totalEarnings')}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              {totals.map((e) => (
                <Text key={e.currency} style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
                  {formatMoney(e.total, e.currency)}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  muted: { fontSize: 13 },
  small: { fontSize: 12.5 },
  subTitle: { fontSize: 13, fontWeight: '700', marginTop: Spacing.lg, marginBottom: Spacing.sm },

  hero: { borderRadius: 24, overflow: 'hidden', padding: Spacing.lg, gap: Spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  heroValue: { color: '#FFFFFF', fontSize: 42, fontWeight: '900', letterSpacing: -0.5 },
  heroUnit: { color: '#FFFFFFD9', fontSize: 16, fontWeight: '700' },
  heroSplit: { color: '#FFFFFFE6', fontSize: 13, fontWeight: '600' },
  heroPills: { flexDirection: 'row', gap: Spacing.sm },
  heroPill: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF26',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF4D',
  },
  heroPillValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  heroPillLabel: { color: '#FFFFFFCC', fontSize: 11, fontWeight: '600' },

  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 19, fontWeight: '800', marginTop: 2 },
  tileUnit: { fontSize: 11, fontWeight: '600' },
  tileLabel: { fontSize: 11.5 },

  moneyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  money: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  moneyCurrency: { fontSize: 15, fontWeight: '800' },
  otherCurrency: { fontSize: 14, fontWeight: '700' },
  earnedBlock: { gap: 6, marginTop: Spacing.md, marginBottom: Spacing.lg },
  earnedRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  inlineLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  inlineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  miniStats: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg },
  miniDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  segmented: { flexDirection: 'row', borderRadius: Radius.full, padding: 3, marginBottom: Spacing.sm },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: Radius.full },
  segmentOn: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },

  donutWrap: { alignItems: 'center', marginBottom: Spacing.md },
  donutValue: { fontSize: 28, fontWeight: '900' },
  donutShare: { fontSize: 13, fontWeight: '800', marginTop: 2 },

  careerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ringValue: { fontSize: 24, fontWeight: '900' },
  rankFlow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rankName: { fontSize: 15, fontWeight: '800', flexShrink: 1 },

  docsTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  docLegend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    paddingEnd: Spacing.md,
    marginBottom: Spacing.sm,
  },
  docBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full },

  tripRow: { flexDirection: 'row', gap: Spacing.md, paddingBottom: Spacing.md },
  tripRail: { alignItems: 'center', width: 14 },
  tripDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, marginTop: 3 },
  tripLine: { flex: 1, width: 2, marginTop: 4, borderRadius: 1 },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripVessel: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  tripMoney: { fontSize: 13.5, fontWeight: '800', alignSelf: 'center' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
  },
});
