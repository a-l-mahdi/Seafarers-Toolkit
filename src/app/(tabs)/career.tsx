import { useMemo, useState } from 'react';
import { Alert, I18nManager, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { DEFAULT_AVATAR } from '@/constants/default-avatar';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeInDown,
  FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, FieldRow, ProgressBar } from '@/components/ui/primitives';
import {
  useProfile,
  useRanks,
  useSeaTimeSummary,
  useContracts,
  useLeaveSettings,
  useSaveProfile,
} from '@/hooks/queries';
import { TripDetail, TripNavigator } from '@/components/trip-detail';
import { RankBadge } from '@/components/epaulette';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { importUriFile, removeImportedFile } from '@/services/file-storage';
import {
  careerProgress,
  estimatedQualificationDate,
  isTopRank,
  promotionDaysFromMonths,
  resolveNextRankId,
} from '@/domain/career';
import { contractPhase } from '@/domain/contract';
import { useTheme } from '@/hooks/use-theme';
import { useFormattedDate } from '@/hooks/use-date-format';
import { Spacing } from '@/constants/theme';
import type { LeaveSettings, Profile } from '@/types/domain';
import { useFloatingTabBarPadding } from '@/components/floating-tab-bar';
import { LineChart } from '@/components/line-chart';
import { buildCareerTimeline, toMonths } from '@/domain/career-timeline';
import { useTabScrollReset, withTabStrip } from '@/components/tab-strip';

const AVATAR = 110;
/** Pull distance (px) that fully expands the photo. */
const PULL = 220;
const EXPAND_MS = 220;

function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const scrollRef = useTabScrollReset<Animated.ScrollView>();
  const formatDate = useFormattedDate();
  const tabPad = useFloatingTabBarPadding();
  const insets = useSafeAreaInsets();

  const { data: profile } = useProfile();
  const { data: ranks } = useRanks();
  const { data: seaTime } = useSeaTimeSummary();
  const { data: contracts } = useContracts();
  const { data: leaveSettings } = useLeaveSettings();

  const rankName = (id: string | null) => ranks?.find((r) => r.id === id)?.name ?? null;
  const currentRank = ranks?.find((r) => r.id === profile?.currentRankId) ?? null;
  const atTopRank = isTopRank(profile?.currentRankId ?? null, ranks ?? []);
  const nextId = resolveNextRankId(profile?.currentRankId ?? null, profile?.nextRankId ?? null, ranks ?? []);
  // Promotion sea time is configured per rank (in months) on the Ranks screen.
  const requiredDays = promotionDaysFromMonths(currentRank?.promotionMonths ?? null);
  const currentRankSeaTime =
    seaTime?.byRank.find((r) => r.rankId && r.rankId === profile?.currentRankId)?.days ?? 0;
  const progress = careerProgress(currentRankSeaTime, requiredDays);

  // The running trip, else the next one ahead (sea time starts on its join date).
  const activeContract =
    contracts?.find((c) => contractPhase(c) === 'active') ??
    [...(contracts ?? [])].reverse().find((c) => contractPhase(c) === 'upcoming') ??
    null;
  const estimated = estimatedQualificationDate(
    progress.remaining,
    activeContract?.joinDate ?? null,
    activeContract?.expectedSignOff ?? null
  );

  // Sea-time charts: cumulative months per rank (always rising), and — for the
  // tapped rank — the days of each of its trips.
  const timeline = useMemo(() => buildCareerTimeline(contracts ?? []), [contracts]);
  const [chartRankId, setChartRankId] = useState<string | null>(null);
  const chartStage = timeline.find((s) => s.rankId === chartRankId) ?? null;
  const [tripId, setTripId] = useState<string | null>(null);
  const tripIndex = chartStage ? chartStage.trips.findIndex((trip) => trip.contractId === tripId) : -1;
  const selectedTrip = chartStage && tripIndex >= 0 ? chartStage.trips[tripIndex] : null;
  const selectedTripContract = selectedTrip ? (contracts ?? []).find((c) => c.id === selectedTrip.contractId) ?? null : null;

  // Telegram-style pull-to-expand: 0 = round avatar, 1 = full-width square photo.
  const hasPhoto = !!profile?.photoPath;
  const expand = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startExpand = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const anchored = useSharedValue(false);
  const [expanded, setExpanded] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const settle = (target: 0 | 1) => {
    expand.value = withTiming(target, { duration: EXPAND_MS });
    setExpanded(target === 1);
  };

  const pan = Gesture.Pan()
    .enabled(hasPhoto)
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onStart(() => {
      startExpand.value = expand.value;
      anchored.value = false;
    })
    .onUpdate((e) => {
      if (startExpand.value < 0.5) {
        // Only a pull that starts (or arrives) at the very top grows the photo.
        if (scrollY.value > 0) {
          anchored.value = false;
          return;
        }
        if (!anchored.value) {
          anchored.value = true;
          anchorY.value = e.translationY;
        }
        expand.value = Math.min(Math.max((e.translationY - anchorY.value) / PULL, 0), 1);
      } else {
        expand.value = Math.min(Math.max(1 + e.translationY / PULL, 0), 1);
      }
    })
    .onEnd((e) => {
      const opening = startExpand.value < 0.5;
      const target = opening
        ? expand.value > 0.4 || (e.velocityY > 900 && expand.value > 0.1)
        : expand.value > 0.6 && e.velocityY > -900;
      expand.value = withTiming(target ? 1 : 0, { duration: EXPAND_MS });
      runOnJS(setExpanded)(target);
    });
  const gesture = Gesture.Simultaneous(pan, Gesture.Native());

  return (
    <GestureDetector gesture={gesture}>
      <Animated.ScrollView ref={scrollRef}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!expanded}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: tabPad }}
        style={{ backgroundColor: colors.background }}
      >
        <ProfileHeader
          profile={profile ?? null}
          rankName={currentRank?.name ?? null}
          expand={expand}
          topPad={insets.top + Spacing.lg}
          onPhotoPress={() => settle(expanded ? 0 : 1)}
        />

        <View style={styles.body}>
          <Card>
            {atTopRank ? (
              <View style={styles.rankTop}>
                <RankBadge insignia={currentRank?.insignia ?? null} size={80} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={2}>
                    {currentRank?.name ?? t('common.notSet')}
                  </Text>
                  <View style={styles.rankTopRow}>
                    <Ionicons name="trophy" size={15} color={colors.success} />
                    <Text style={{ color: colors.success, fontWeight: '600' }}>{t('career.topRank')}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.rankPath}>
                <View style={styles.rankStep}>
                  <RankBadge insignia={currentRank?.insignia ?? null} size={80} />
                  <Text style={[styles.rankCaption, { color: colors.textMuted }]}>{t('career.currentRank')}</Text>
                  <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={2}>
                    {currentRank?.name ?? t('common.notSet')}
                  </Text>
                </View>
                <View style={[styles.rankArrow, { backgroundColor: colors.primaryMuted }]}>
                  <Ionicons name="arrow-forward" size={18} color={colors.primary} style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
                </View>
                <View style={styles.rankStep}>
                  <RankBadge insignia={ranks?.find((r) => r.id === nextId)?.insignia ?? null} size={80} />
                  <Text style={[styles.rankCaption, { color: colors.textMuted }]}>{t('career.nextRank')}</Text>
                  <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={2}>
                    {rankName(nextId) ?? t('common.notSet')}
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {!atTopRank ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('career.progress')}</Text>
              <FieldRow label={t('career.requiredSeaTime')} value={`${requiredDays} ${t('common.days')}`} />
              <FieldRow label={t('career.completed')} value={`${currentRankSeaTime} ${t('common.days')}`} />
              <FieldRow label={t('career.remaining')} value={`${progress.remaining} ${t('common.days')}`} />
              <ProgressBar progress={progress.progress} tone={progress.complete ? 'success' : 'primary'} />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {Math.round(progress.progress * 100)}%
              </Text>
              {progress.complete ? (
                <Text style={{ color: colors.success, fontWeight: '600' }}>{t('career.complete')}</Text>
              ) : (
                <FieldRow
                  label={t('career.estimatedDate')}
                  value={estimated ? formatDate(estimated) : t('career.notPredictable')}
                />
              )}
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: Spacing.sm }}>
                {t('career.requirementInRanks')}
              </Text>
            </Card>
          ) : null}

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

          {timeline.length > 0 ? (
            <Card>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.seaTimeChart')}</Text>
              <LineChart
                unit={t('common.month')}
                labels="selected"
                selectedKey={chartRankId}
                onSelect={(key) => {
                  setChartRankId((prev) => (prev === key ? null : key));
                  setTripId(null);
                }}
                points={timeline.map((s) => ({
                  key: s.rankId,
                  value: toMonths(s.cumulativeDays),
                  above: rankName(s.rankId) ?? '—',
                  below: `${toMonths(s.days)} ${t('common.month')}`,
                }))}
              />
            </Card>
          ) : null}

          {chartStage ? (
            <Animated.View key={chartStage.rankId} entering={FadeInDown.duration(260)} exiting={FadeOut.duration(150)}>
              <Card>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('profile.rankTrips', { rank: rankName(chartStage.rankId) ?? '—' })}
                </Text>
                <LineChart
                  unit={t('common.days')}
                  color={colors.success}
                  focusSelected
                  selectedKey={tripId}
                  onSelect={(key) => setTripId((prev) => (prev === key ? null : key))}
                  points={chartStage.trips.map((trip) => ({
                    key: trip.contractId,
                    value: trip.days,
                    above: `${trip.days} ${t('common.days')}`,
                    below: trip.vesselName ?? '—',
                  }))}
                />
                {selectedTrip && chartStage && chartStage.trips.length > 1 ? (
                  <Animated.View key="trip-nav" entering={FadeInDown.duration(240)}>
                    <TripNavigator
                      index={tripIndex}
                      total={chartStage.trips.length}
                      onChange={(i) => setTripId(chartStage.trips[i]?.contractId ?? null)}
                    />
                  </Animated.View>
                ) : null}
                {selectedTrip && selectedTripContract ? (
                  <Animated.View key={selectedTrip.contractId} entering={FadeInDown.duration(240)}>
                    <TripDetail
                      contract={selectedTripContract}
                      days={selectedTrip.days}
                      leaveSettings={leaveSettings ?? DEFAULT_LEAVE}
                    />
                  </Animated.View>
                ) : null}
              </Card>
            </Animated.View>
          ) : null}
        </View>
      </Animated.ScrollView>
    </GestureDetector>
  );
}

const DEFAULT_LEAVE: LeaveSettings = {
  mode: 'ratio',
  onboardDays: 120,
  leaveDays: 60,
  manualLeaveStartDate: null,
  manualLeaveEndDate: null,
};

const EMPTY_PROFILE: Profile = {
  id: '',
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  nationality: null,
  email: null,
  phone: null,
  seamanBookNumber: null,
  passportNumber: null,
  address: null,
  city: null,
  state: null,
  country: null,
  zipCode: null,
  landline: null,
  department: null,
  currentRankId: null,
  nextRankId: null,
  photoPath: null,
  updatedAt: '',
};

/** Avatar, name and rank with the "set photo" / "edit profile" tiles. The avatar
 *  grows into a full-width square photo (name overlaid) as `expand` goes 0 → 1. */
function ProfileHeader({
  profile,
  rankName,
  expand,
  topPad,
  onPhotoPress,
}: {
  profile: Profile | null;
  rankName: string | null;
  expand: SharedValue<number>;
  topPad: number;
  onPhotoPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const save = useSaveProfile();
  const { width } = useWindowDimensions();
  const nameHeight = useSharedValue(0);

  const fullName = [profile?.firstName, profile?.lastName].filter((p) => p && p.trim()).join(' ');
  const photoPath = profile?.photoPath ?? null;

  const savePhoto = (next: string | null) => {
    const { id: _id, updatedAt: _updatedAt, ...rest } = profile ?? EMPTY_PROFILE;
    save.mutate({ ...rest, photoPath: next });
  };

  const setPhoto = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await capturePhoto() : await pickPhoto();
    if (!uri) return;
    const localPath = await importUriFile('profile', uri, `photo_${Date.now()}.jpg`);
    if (photoPath && photoPath !== localPath) void removeImportedFile(photoPath);
    savePhoto(localPath);
  };

  const removePhoto = () => {
    if (photoPath) void removeImportedFile(photoPath);
    savePhoto(null);
  };

  // System dialog: the user picks gallery or camera (and remove, when a photo is set).
  const choosePhotoSource = () => {
    Alert.alert(
      t('profile.setPhoto'),
      undefined,
      [
        photoPath
          ? { text: t('profile.photoRemove'), style: 'destructive', onPress: removePhoto }
          : { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.photoCamera'), onPress: () => void setPhoto('camera') },
        { text: t('profile.photoGallery'), onPress: () => void setPhoto('gallery') },
      ],
      { cancelable: true }
    );
  };

  const textColor = colors.text;
  const mutedColor = colors.textMuted;

  const photoStyle = useAnimatedStyle(() => {
    const size = AVATAR + (width - AVATAR) * expand.value;
    return {
      width: size,
      height: size,
      borderRadius: (AVATAR / 2) * (1 - expand.value),
      marginTop: topPad * (1 - expand.value),
    };
  });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.45 * expand.value }));
  // The name block slides up onto the bottom of the photo; the tiles take its place.
  const nameBlockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(nameHeight.value + Spacing.md * 2) * expand.value }],
  }));
  const tilesStyle = useAnimatedStyle(() => ({
    marginTop: Spacing.md - (nameHeight.value + Spacing.md) * expand.value,
  }));
  const nameColor = useAnimatedStyle(() => ({
    color: interpolateColor(expand.value, [0, 1], [textColor, '#FFFFFF']),
  }));
  const rankColor = useAnimatedStyle(() => ({
    color: interpolateColor(expand.value, [0, 1], [mutedColor, '#FFFFFFDD']),
  }));

  return (
    <View style={styles.header}>
      <Pressable onPress={photoPath ? onPhotoPress : choosePhotoSource}>
        <Animated.View style={[styles.photo, photoStyle, { backgroundColor: colors.surfaceMuted }]}>
          <Image
            source={photoPath ? { uri: photoPath } : DEFAULT_AVATAR}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <Animated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
        </Animated.View>
      </Pressable>

      <Animated.View
        pointerEvents="none"
        style={[styles.nameBlock, nameBlockStyle]}
        onLayout={(e) => {
          nameHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.Text
          style={[styles.name, nameColor]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {fullName || t('common.notSet')}
        </Animated.Text>
        {rankName ? (
          <Animated.Text
            style={[styles.rank, rankColor]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {rankName}
          </Animated.Text>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.tiles, tilesStyle]}>
        <Pressable
          onPress={choosePhotoSource}
          android_ripple={{ color: colors.primaryMuted }}
          style={[styles.tile, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="camera" size={21} color={colors.primary} />
          <Text style={[styles.tileText, { color: colors.text }]} numberOfLines={1}>
            {t('profile.setPhoto')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/profile-form')}
          android_ripple={{ color: colors.primaryMuted }}
          style={[styles.tile, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="pencil" size={19} color={colors.primary} />
          <Text style={[styles.tileText, { color: colors.text }]} numberOfLines={1}>
            {t('profile.edit')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rankPath: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankStep: { flex: 1, alignItems: 'center', gap: 4 },
  rankArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  rankCaption: { fontSize: 12, fontWeight: '600', marginTop: Spacing.sm },
  rankName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  rankTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  rankTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { alignItems: 'center', marginBottom: Spacing.md },
  photo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', backgroundColor: '#000' },
  nameBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: 2,
  },
  name: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  rank: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch', paddingHorizontal: Spacing.lg },
  tile: {
    flex: 1,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  tileText: { fontSize: 14, fontWeight: '600' },
  body: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
});

export default withTabStrip(ProfileScreen, 3);
