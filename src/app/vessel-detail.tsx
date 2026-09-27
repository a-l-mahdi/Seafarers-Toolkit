import { useEffect, useId, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { Card, EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { useContracts, useVessels } from '@/hooks/queries';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { contractCountdown } from '@/domain/contract';
import { Radius, Spacing } from '@/constants/theme';
import type { Vessel } from '@/types/domain';
import { CountryFlag } from '@/components/country-picker';
import { countryLabel, resolveCountry } from '@/domain/countries';

type IconName = keyof typeof Ionicons.glyphMap;

const SITE_ICONS = {
  vesselfinder: require('@/assets/images/vesselfinder.png'),
  marinetraffic: require('@/assets/images/marinetraffic.png'),
};

export default function VesselDetailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: vessels } = useVessels();
  const vessel = vessels?.find((v) => v.id === id) ?? null;
  const missing = !!vessels && !vessel;

  // Deleted elsewhere: leave the page instead of showing "not found".
  useEffect(() => {
    if (missing && router.canGoBack()) router.back();
  }, [missing, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={vessel?.name ?? t('vessels.title')}
        onBack={() => router.back()}
        actions={
          vessel
            ? [{ icon: 'pencil', label: t('common.edit'), onPress: () => router.push(`/vessel-form?id=${vessel.id}`) }]
            : []
        }
      />
      {vessel ? <VesselBody vessel={vessel} /> : <EmptyState title={t('vessels.noVessels')} />}
    </View>
  );
}

function VesselBody({ vessel }: { vessel: Vessel }) {
  const { t, i18n } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const { data: contracts } = useContracts();

  const trips = (contracts ?? []).filter((c) => c.vesselId === vessel.id);
  const daysAboard = trips.reduce((sum, c) => sum + contractCountdown(c).elapsedDays, 0);

  const details: { icon: IconName; label: string; value: string | null; ltr?: boolean; flag?: string }[] = [
    { icon: 'barcode-outline', label: t('vessels.imo'), value: vessel.imo, ltr: true },
    { icon: 'boat-outline', label: t('vessels.type'), value: vessel.type },
    {
      icon: 'flag-outline',
      label: t('vessels.flag'),
      value: countryLabel(vessel.flag, i18n.language),
      flag: resolveCountry(vessel.flag)?.code,
    },
  ];
  const company: { icon: IconName; label: string; value: string | null }[] = [
    { icon: 'business-outline', label: t('vessels.owner'), value: vessel.owner },
    { icon: 'briefcase-outline', label: t('vessels.management'), value: vessel.managementCompany },
  ];
  const links = [
    { key: 'vesselfinder' as const, name: 'VesselFinder', url: vessel.vesselFinderUrl },
    { key: 'marinetraffic' as const, name: 'MarineTraffic', url: vessel.marineTrafficUrl },
  ].filter((l): l is { key: 'vesselfinder' | 'marinetraffic'; name: string; url: string } => !!l.url);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
    >
      <Hero vessel={vessel} />

      <View style={styles.tiles}>
        <Tile icon="scale-balance" label="GT" value={vessel.grossTonnage?.toLocaleString('en-US') ?? '—'} />
        <Tile icon="scale" label="NT" value={vessel.netTonnage?.toLocaleString('en-US') ?? '—'} />
        <Tile icon="ferry" label={t('vessels.trips')} value={String(trips.length)} />
        <Tile icon="calendar-check" label={t('vessels.daysAboard')} value={String(daysAboard)} />
      </View>

      <InfoCard icon="document-text-outline" title={t('vessels.details')} rows={details} />
      <InfoCard icon="business-outline" title={t('vessels.company')} rows={company} />

      {vessel.notes ? (
        <Card>
          <SectionHeader icon="create-outline" title={t('vessels.notes')} />
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }} selectable>
            {vessel.notes}
          </Text>
        </Card>
      ) : null}

      {links.length > 0 ? (
        <Card>
          <SectionHeader icon="globe-outline" title={t('vessels.seeOn')} />
          <View style={styles.links}>
            {links.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => void Linking.openURL(l.url)}
                style={({ pressed }) => [
                  styles.link,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View style={[styles.linkIcon, { backgroundColor: '#FFFFFF' }]}>
                  <Image source={SITE_ICONS[l.key]} style={styles.linkImage} contentFit="contain" />
                </View>
                <Text style={[styles.linkName, { color: colors.text }]} numberOfLines={1}>
                  {l.name}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** The vessel photo (or an ocean gradient) with its name, type and flag. */
function Hero({ vessel }: { vessel: Vessel }) {
  const { i18n } = useTranslation();
  const ocean = useOcean();
  const flagCode = resolveCountry(vessel.flag)?.code;
  const flagName = countryLabel(vessel.flag, i18n.language);
  const gid = `v-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });

  return (
    <View
      style={styles.hero}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {vessel.photoPath ? (
        <Image source={{ uri: vessel.photoPath }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : null}
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${gid}-bg`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ocean.bright} />
              <Stop offset="1" stopColor={ocean.deep} />
            </LinearGradient>
            <LinearGradient id={`${gid}-scrim`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.7" />
            </LinearGradient>
          </Defs>
          {vessel.photoPath ? (
            <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid}-scrim)`} />
          ) : (
            <>
              <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid}-bg)`} />
              <Circle cx={size.w * 0.9} cy={size.h * 0.05} r={size.h * 0.55} fill="#FFFFFF" opacity={0.08} />
              <Circle cx={size.w * 0.05} cy={size.h * 1.1} r={size.h * 0.5} fill="#FFFFFF" opacity={0.06} />
            </>
          )}
        </Svg>
      ) : null}
      {vessel.photoPath ? null : (
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="ferry" size={64} color="#FFFFFF" />
        </View>
      )}
      {flagCode ? (
        <View style={styles.heroFlag}>
          <CountryFlag code={flagCode} width={42} />
        </View>
      ) : null}
      <View style={styles.heroText}>
        <Text style={styles.heroName} numberOfLines={2}>
          {vessel.name}
        </Text>
        <View style={styles.chips}>
          {vessel.imo ? <Chip icon="barcode-outline" text={`IMO ${vessel.imo}`} /> : null}
          {vessel.type ? <Chip icon="boat-outline" text={vessel.type} /> : null}
          {flagName ? <Chip icon="flag-outline" text={flagName} flag={flagCode} /> : null}
        </View>
      </View>
    </View>
  );
}

function Chip({ icon, text, flag }: { icon: IconName; text: string; flag?: string }) {
  return (
    <View style={styles.chip}>
      {flag ? <CountryFlag code={flag} width={18} /> : <Ionicons name={icon} size={12} color="#FFFFFF" />}
      <Text style={styles.chipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  const colors = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.primaryMuted }]}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  rows,
}: {
  icon: IconName;
  title: string;
  rows: { icon: IconName; label: string; value: string | null; ltr?: boolean; flag?: string }[];
}) {
  const colors = useTheme();
  const filled = rows.filter((r) => r.value);
  if (filled.length === 0) return null;
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      {filled.map((r, i) => (
        <View
          key={r.label}
          style={[
            styles.row,
            { borderBottomColor: colors.border },
            i === filled.length - 1 ? { borderBottomWidth: 0 } : null,
          ]}
        >
          <Ionicons name={r.icon} size={17} color={colors.textMuted} />
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{r.label}</Text>
          <Text
            style={[styles.rowValue, { color: colors.text }, r.ltr && { writingDirection: 'ltr' }]}
            selectable
            numberOfLines={2}
          >
            {r.value}
          </Text>
          {r.flag ? <CountryFlag code={r.flag} width={26} /> : null}
        </View>
      ))}
    </Card>
  );
}

function SectionHeader({ icon, title }: { icon: IconName; title: string }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  hero: { aspectRatio: 16 / 10, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 56,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  heroFlag: {
    position: 'absolute',
    top: Spacing.md,
    end: Spacing.md,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF33',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF66',
  },
  heroText: { padding: Spacing.lg, gap: Spacing.sm },
  heroName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF2E',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF55',
  },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 16, fontWeight: '800' },
  tileLabel: { fontSize: 11, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 13, fontWeight: '600' },
  rowValue: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  links: { gap: Spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  linkImage: { width: 28, height: 28 },
  linkName: { flex: 1, fontSize: 15, fontWeight: '700' },
});
