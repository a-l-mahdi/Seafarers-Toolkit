import { useEffect, useId, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Card, EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { ViewerModal, isImageFile, type DisplayFile } from '@/components/file-gallery';
import { DocTypeIcon } from '@/components/doc-icon';
import { useDeleteDocument, useDeleteDocumentFile, useDocumentFiles, useDocuments } from '@/hooks/queries';
import { removeImportedFile } from '@/services/file-storage';
import { resolveDocIcon } from '@/domain/document-icons';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { addDaysISO, diffInDays, todayISO } from '@/utils/date';
import { Radius, Spacing } from '@/constants/theme';
import type { DocumentListRow } from '@/hooks/queries';

type IconName = keyof typeof Ionicons.glyphMap;

export default function DocumentDetailScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: documents } = useDocuments();
  const doc = documents?.find((d) => d.id === id) ?? null;
  const missing = !!documents && !doc;

  // Deleted from the edit form: leave the page instead of showing "not found".
  useEffect(() => {
    if (missing && router.canGoBack()) router.back();
  }, [missing, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={doc?.name ?? t('documents.title')}
        onBack={() => router.back()}
        actions={
          doc
            ? [{ icon: 'pencil', label: t('common.edit'), onPress: () => router.push(`/document-form?id=${doc.id}`) }]
            : []
        }
      />
      {doc ? <DocumentBody doc={doc} /> : <EmptyState title={t('documents.notFound')} />}
    </View>
  );
}

function useStatusColor(status: DocumentListRow['status']): string {
  const colors = useTheme();
  if (status === 'expired') return colors.danger;
  if (status === 'expiring_soon' || status === 'not_valid') return colors.warning;
  if (status === 'valid') return colors.success;
  return colors.primary;
}

function DocumentBody({ doc }: { doc: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const remove = useDeleteDocument();

  const confirmDelete = () => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove.mutate(doc.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
    >
      <FilesGallery documentId={doc.id} />
      <DocHero doc={doc} />
      <ValidityCard doc={doc} />
      <DetailsCard doc={doc} />
      <Pressable
        onPress={confirmDelete}
        style={({ pressed }) => [styles.deleteBtn, { borderColor: colors.danger, opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('common.delete')}</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Remembers each document's shown photo while the app runs, so coming back
 *  to a document shows the same picture. */
const lastPhoto = new Map<string, string>();

const THUMB = 56;
const THUMB_GAP = 10;
const STEP = THUMB + THUMB_GAP;
const SLIDE = { duration: 260 };

/** The document's photos: swipe the big picture, or scrub the thumbnail strip
 *  (the centred thumbnail is the one shown). */
function FilesGallery({ documentId }: { documentId: string }) {
  const { t } = useTranslation();
  const { data: saved } = useDocumentFiles(documentId);
  const deleteFile = useDeleteDocumentFile();
  const [viewer, setViewer] = useState<DisplayFile | null>(null);
  // Bumped when the viewer closes, so the carousel reopens on the photo last viewed.
  const [round, setRound] = useState(0);

  const images: DisplayFile[] = (saved ?? [])
    .filter((f) => isImageFile(f.fileName))
    .map((f) => ({ id: f.id, uri: f.localPath, name: f.fileName }));
  if (images.length === 0) return null;

  const removeFile = (fileId: string) => {
    const row = saved?.find((f) => f.id === fileId);
    if (!row) return;
    void removeImportedFile(row.localPath);
    deleteFile.mutate({ id: row.id, documentId });
  };
  const confirmRemove = (file: DisplayFile) =>
    Alert.alert(t('common.delete'), file.name, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeFile(file.id) },
    ]);

  const start = Math.max(
    images.findIndex((f) => f.id === lastPhoto.get(documentId)),
    0,
  );

  return (
    <>
      <PhotoCarousel
        key={`${images.map((f) => f.id).join('|')}#${round}`}
        images={images}
        initial={start}
        onIndex={(i) => lastPhoto.set(documentId, images[i].id)}
        onOpen={setViewer}
        onLongPress={confirmRemove}
      />
      <ViewerModal
        file={viewer}
        files={images}
        onIndexChange={(f) => lastPhoto.set(documentId, f.id)}
        onClose={() => {
          setViewer(null);
          setRound((r) => r + 1);
        }}
        onRemove={(fid) => removeFile(fid)}
      />
    </>
  );
}

function PhotoCarousel({
  images,
  initial,
  onIndex,
  onOpen,
  onLongPress,
}: {
  images: DisplayFile[];
  initial: number;
  onIndex: (index: number) => void;
  onOpen: (file: DisplayFile) => void;
  onLongPress: (file: DisplayFile) => void;
}) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const W = width - 2 * Spacing.lg;
  const H = Math.round((W * 2) / 3);
  const last = images.length - 1;
  const [current, setCurrent] = useState(initial);
  // The shown position in photos (fractional while sliding); both the big
  // picture and the thumbnail strip follow it.
  const pos = useSharedValue(initial);
  const from = useSharedValue(initial);

  const show = (i: number) => {
    setCurrent(i);
    onIndex(i);
  };
  const gestures = useMemo(() => {
    const clampDrag = (p: number) => {
      'worklet';
      return Math.min(Math.max(p, -0.3), last + 0.3);
    };
    const main = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        from.value = Math.round(pos.value);
      })
      .onUpdate((e) => {
        pos.value = clampDrag(from.value - e.translationX / W);
      })
      .onEnd((e) => {
        const projected = pos.value - (e.velocityX * 0.2) / W;
        const target = Math.min(Math.max(Math.round(projected), from.value - 1, 0), from.value + 1, last);
        pos.value = withTiming(target, SLIDE);
      });
    const tap = Gesture.Tap().onEnd(() => {
      runOnJS(onOpen)(images[Math.round(pos.value)]);
    });
    const hold = Gesture.LongPress().onStart(() => {
      runOnJS(onLongPress)(images[Math.round(pos.value)]);
    });

    const strip = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        from.value = pos.value;
      })
      .onUpdate((e) => {
        pos.value = clampDrag(from.value - e.translationX / STEP);
      })
      .onEnd((e) => {
        const projected = pos.value - (e.velocityX * 0.25) / STEP;
        pos.value = withTiming(Math.min(Math.max(Math.round(projected), 0), last), SLIDE);
      });
    const pick = Gesture.Tap().onEnd((e) => {
      const i = Math.round(pos.value + (e.x - W / 2) / STEP);
      if (i >= 0 && i <= last) pos.value = withTiming(i, SLIDE);
    });

    return {
      main: Gesture.Race(main, Gesture.Exclusive(hold, tap)),
      strip: Gesture.Race(strip, pick),
    };
    // Shared values are stable identities (like refs); including them as deps
    // would trip React Compiler's immutability rule (mutating hook dependencies).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, last, images, onOpen, onLongPress]);

  useAnimatedReaction(
    () => Math.min(Math.max(Math.round(pos.value), 0), last),
    (i, prev) => {
      if (prev !== null && i !== prev) runOnJS(show)(i);
    },
  );

  const slides = useAnimatedStyle(() => ({ transform: [{ translateX: -pos.value * W }] }));
  const thumbs = useAnimatedStyle(() => ({ transform: [{ translateX: W / 2 - THUMB / 2 - pos.value * STEP }] }));

  return (
    <View style={{ gap: Spacing.md }}>
      <GestureDetector gesture={gestures.main}>
        <View style={[styles.featured, { width: W, height: H }]} collapsable={false}>
          <Animated.View style={[styles.slides, { width: W * images.length }, slides]}>
            {images.map((file) => (
              <Image
                key={file.id}
                source={{ uri: file.uri }}
                style={{ width: W, height: H }}
                contentFit="cover"
                transition={200}
              />
            ))}
          </Animated.View>
          {images.length > 1 ? (
            <View style={styles.countBadge}>
              <Ionicons name="images" size={13} color="#FFFFFF" />
              <Text style={styles.countText}>
                {current + 1} / {images.length}
              </Text>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      {images.length > 1 ? (
        <GestureDetector gesture={gestures.strip}>
          <View style={[styles.strip, { width: W }]} collapsable={false}>
            <Animated.View style={[styles.slides, thumbs]}>
              {images.map((file, i) => (
                <Thumb key={file.id} uri={file.uri} index={i} pos={pos} />
              ))}
            </Animated.View>
            <View
              pointerEvents="none"
              style={[styles.thumbFocus, { start: W / 2 - THUMB / 2 - 4, borderColor: colors.primary }]}
            />
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

function Thumb({ uri, index, pos }: { uri: string; index: number; pos: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(Math.abs(pos.value - index), 1);
    return { opacity: 1 - d * 0.45, transform: [{ scale: 1 - d * 0.14 }] };
  });
  return (
    <Animated.View style={[styles.thumb, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
  );
}

/** Coloured header card: the type icon, name, number and a days-left ring. */
function DocHero({ doc }: { doc: DocumentListRow }) {
  const { t } = useTranslation();
  const ocean = useOcean();
  const icon = resolveDocIcon(doc.typeId, doc.typeIcon, doc.typeColor);
  const statusColor = useStatusColor(doc.status);
  const gid = `doc-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });

  const total = doc.expiryDate && doc.issueDate ? Math.max(diffInDays(doc.issueDate, doc.expiryDate), 1) : 365;
  const left = doc.daysUntilExpiry;
  const fraction = left == null ? 1 : Math.min(Math.max(left / total, 0), 1);
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <View
      style={styles.hero}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={icon.color} />
              <Stop offset="1" stopColor={ocean.deep} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid})`} />
          <Circle cx={size.w * 0.08} cy={size.h * 1.05} r={size.h * 0.6} fill="#FFFFFF" opacity={0.07} />
        </Svg>
      ) : null}
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name={icon.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={30}
            color="#FFFFFF"
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.heroName} numberOfLines={2}>
            {doc.name}
          </Text>
          {doc.typeName && doc.typeName !== doc.name ? (
            <Text style={styles.heroType} numberOfLines={1}>
              {doc.typeName}
            </Text>
          ) : null}
          {doc.number ? (
            <Text style={styles.heroNumber} numberOfLines={1} selectable>
              {doc.number}
            </Text>
          ) : null}
          <View style={[styles.statusPill, { backgroundColor: '#FFFFFF' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{t(`documents.status.${doc.status}`)}</Text>
          </View>
        </View>
        <View style={styles.ring}>
          <Svg width={72} height={72}>
            <Circle cx={36} cy={36} r={R} stroke="#FFFFFF40" strokeWidth={6} fill="none" />
            <Circle
              cx={36}
              cy={36}
              r={R}
              stroke="#FFFFFF"
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C * fraction} ${C}`}
              transform="rotate(-90 36 36)"
            />
          </Svg>
          <View style={styles.ringLabel}>
            {left == null ? (
              <MaterialCommunityIcons name="infinity" size={24} color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ringValue}>{Math.max(left, 0)}</Text>
                <Text style={styles.ringUnit}>{t('common.days')}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Issue → expiry timeline with today's marker and the key renewal dates. */
function ValidityCard({ doc }: { doc: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const statusColor = useStatusColor(doc.status);
  if (!doc.expiryDate) return null;

  const start = doc.issueDate ?? addDaysISO(doc.expiryDate, -365);
  const span = Math.max(diffInDays(start, doc.expiryDate), 1);
  const elapsed = Math.min(Math.max(diffInDays(start, todayISO()) / span, 0), 1);
  const joinUntil = doc.validThresholdDays ? addDaysISO(doc.expiryDate, -doc.validThresholdDays) : null;
  const renewFrom = doc.warningThresholdDays ? addDaysISO(doc.expiryDate, -doc.warningThresholdDays) : null;

  const rows: { icon: IconName; color: string; label: string; value: string }[] = [];
  if (renewFrom)
    rows.push({
      icon: 'notifications-outline',
      color: colors.warning,
      label: t('documents.renewFrom'),
      value: formatDate(renewFrom),
    });
  if (joinUntil)
    rows.push({
      icon: 'boat-outline',
      color: colors.primary,
      label: t('documents.joinUntil'),
      value: formatDate(joinUntil),
    });

  return (
    <Card>
      <SectionHeader icon="hourglass-outline" color={statusColor} title={t('documents.validity')} />
      <View style={[styles.timeline, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.timelineFill, { width: `${Math.round(elapsed * 100)}%`, backgroundColor: statusColor }]} />
        <View
          style={[
            styles.todayMark,
            { start: `${Math.round(elapsed * 100)}%`, borderColor: statusColor, backgroundColor: colors.surface },
          ]}
        />
      </View>
      <View style={styles.timelineEnds}>
        <Text style={[styles.endLabel, { color: colors.textMuted }]}>
          {doc.issueDate ? formatDate(doc.issueDate) : '—'}
        </Text>
        <Text style={[styles.endLabel, { color: colors.textMuted }]}>{formatDate(doc.expiryDate)}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={[styles.keyDate, { backgroundColor: `${r.color}14` }]}>
          <Ionicons name={r.icon} size={18} color={r.color} />
          <Text style={[styles.keyLabel, { color: colors.text }]} numberOfLines={2}>
            {r.label}
          </Text>
          <Text style={[styles.keyValue, { color: r.color }]}>{r.value}</Text>
        </View>
      ))}
    </Card>
  );
}

/** Every filled-in field of the document. */
function DetailsCard({ doc }: { doc: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  const icon = resolveDocIcon(doc.typeId, doc.typeIcon, doc.typeColor);
  const all: { icon: IconName; label: string; value: string | null }[] = [
    { icon: 'keypad-outline', label: t('documents.number'), value: doc.number },
    { icon: 'pricetag-outline', label: t('documents.type'), value: doc.typeName },
    {
      icon: 'calendar-outline',
      label: t('documents.issueDate'),
      value: doc.issueDate ? formatDate(doc.issueDate) : null,
    },
    {
      icon: 'calendar',
      label: t('documents.expiryDate'),
      value: doc.expiryDate ? formatDate(doc.expiryDate) : t('documents.noExpiry'),
    },
    { icon: 'business-outline', label: t('documents.authority'), value: doc.issuingAuthority },
    { icon: 'earth-outline', label: t('documents.country'), value: doc.issuingCountry },
    { icon: 'location-outline', label: t('documents.placeOfIssue'), value: doc.placeOfIssue },
  ];
  const rows = all.filter((r) => r.value);

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <DocTypeIcon value={icon} size={30} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('documents.details')}</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[
            styles.detailRow,
            { borderBottomColor: colors.border },
            i === rows.length - 1 && !doc.notes ? styles.lastRow : null,
          ]}
        >
          <Ionicons name={r.icon} size={17} color={colors.textMuted} />
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{r.label}</Text>
          <Text style={[styles.detailValue, { color: colors.text }]} selectable numberOfLines={2}>
            {r.value}
          </Text>
        </View>
      ))}
      {doc.notes ? (
        <View style={[styles.notes, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('documents.notes')}</Text>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 21 }} selectable>
            {doc.notes}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function SectionHeader({ icon, color, title }: { icon: IconName; color: string; title: string }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}1F` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  featured: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#00000010', direction: 'ltr' },
  countBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    end: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00000080',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  slides: { flexDirection: 'row', direction: 'ltr' },
  strip: { height: THUMB + 12, justifyContent: 'center', overflow: 'hidden', direction: 'ltr' },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', marginEnd: THUMB_GAP },
  thumbFocus: { position: 'absolute', width: THUMB + 8, height: THUMB + 8, borderRadius: 17, borderWidth: 2.5 },
  hero: { borderRadius: 22, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FFFFFF2E',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroName: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  heroType: { color: '#FFFFFFB3', fontSize: 13, fontWeight: '600' },
  heroNumber: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 1.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  ring: { width: 72, height: 72 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  ringUnit: { color: '#FFFFFFB3', fontSize: 10, fontWeight: '600', marginTop: -2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  timeline: { height: 10, borderRadius: 5, justifyContent: 'center', marginHorizontal: 8 },
  timelineFill: { position: 'absolute', top: 0, bottom: 0, start: 0, borderRadius: 5 },
  todayMark: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 4, marginStart: -9 },
  timelineEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: Spacing.sm },
  endLabel: { fontSize: 12, fontWeight: '600' },
  keyDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  keyLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  keyValue: { fontSize: 14, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  notes: { borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingVertical: 13,
  },
});
