import { useId, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  BOARD,
  CLOTH_COLORS,
  CLOTH_OPTIONS,
  clothColor as clothFill,
  isCustomCloth,
  DEFAULT_INSIGNIA,
  STRIPE_OPTIONS,
  stripeBands,
  type Insignia,
  type InsigniaCloth,
  type InsigniaEmblem,
  type NamedCloth,
} from '@/domain/insignia';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

/** Shoulder board outline: straight sides, rounded button end on top. */
const BOARD_PATH = 'M9,126 L55,126 Q60,126 60,121 L60,28 C60,13 47,4 32,4 C17,4 4,13 4,28 L4,121 Q4,126 9,126 Z';
/** Diamond around its centre (0 = centre height); half-height 17. */
const DIAMOND_HALF = 17;
const DIAMOND_OUTER = 'M32,-17 L49,0 L32,17 L15,0 Z';
const DIAMOND_INNER = 'M32,-5.5 L37.5,0 L32,5.5 L26.5,0 Z';
/** Embroidery facets from each outer corner to the hole. */
/** Round emblem: a thick gold ring (outer / inner radius). */
const RING_OUTER = 14;
const RING_INNER = 7.5;
const RING_MID = (RING_OUTER + RING_INNER) / 2;
const DIAMOND_FACETS = 'M32,-17 L32,-5.5 M49,0 L37.5,0 M32,17 L32,5.5 M15,0 L26.5,0';

/**
 * A merchant-navy epaulette drawn to scale: navy board, gold button and
 * diamond, bullion stripes and the branch's distinction cloth.
 * `size` is the height; the board is half as wide.
 */
export function Epaulette({ insignia, size = 64 }: { insignia: Insignia; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `ep${uid}${name}`;
  const bands = stripeBands(insignia);
  // Without stripes the diamond sits in the middle of the board.
  // Otherwise its lower point rests on the top gold stripe, as embroidered.
  const topGold = Math.min(...bands.filter((b) => b.kind === 'gold').map((b) => b.y));
  const circle = insignia.emblem === 'circle';
  const emblemHalf = circle ? RING_OUTER : DIAMOND_HALF;
  const diamondY = bands.length === 0 ? 65 : topGold - emblemHalf + 0.6;
  const clothColor = clothFill(insignia.cloth);

  return (
    <Svg width={size / 2} height={size} viewBox={`0 0 ${BOARD.width} ${BOARD.height + 2}`}>
      <Defs>
        <LinearGradient id={id('board')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#0B1222" />
          <Stop offset="0.35" stopColor="#1F2B47" />
          <Stop offset="0.65" stopColor="#1A2540" />
          <Stop offset="1" stopColor="#080E1B" />
        </LinearGradient>
        <LinearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF1B0" />
          <Stop offset="0.3" stopColor="#F2CA4E" />
          <Stop offset="0.7" stopColor="#D9A21C" />
          <Stop offset="1" stopColor="#9C6F08" />
        </LinearGradient>
        <LinearGradient id={id('goldH')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF4BF" />
          <Stop offset="0.45" stopColor="#E8B730" />
          <Stop offset="1" stopColor="#A87908" />
        </LinearGradient>
        <LinearGradient id={id('shade')} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000000" stopOpacity="0.35" />
          <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="0.7" stopColor="#000000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.4" />
        </LinearGradient>
        <ClipPath id={id('clip')}>
          <Path d={BOARD_PATH} />
        </ClipPath>
      </Defs>

      {/* Drop shadow */}
      <Path d={BOARD_PATH} fill="#000000" opacity={0.28} transform="translate(0,2)" />
      <Path d={BOARD_PATH} fill={`url(#${id('board')})`} />

      <G clipPath={`url(#${id('clip')})`}>
        {bands.map((b, i) =>
          b.kind === 'cloth' ? (
            <Rect key={i} x={0} y={b.y} width={BOARD.width} height={b.h} fill={clothColor ?? 'transparent'} />
          ) : (
            <G key={i}>
              <Rect x={0} y={b.y} width={BOARD.width} height={b.h} fill={`url(#${id('gold')})`} />
              {/* Bullion threads */}
              <Line
                x1={0}
                y1={b.y + b.h * 0.36}
                x2={BOARD.width}
                y2={b.y + b.h * 0.36}
                stroke="#8A6206"
                strokeWidth={0.45}
                opacity={0.45}
              />
              {b.h > 8 ? (
                <Line
                  x1={0}
                  y1={b.y + b.h * 0.68}
                  x2={BOARD.width}
                  y2={b.y + b.h * 0.68}
                  stroke="#8A6206"
                  strokeWidth={0.45}
                  opacity={0.4}
                />
              ) : null}
              <Line
                x1={0}
                y1={b.y + 0.5}
                x2={BOARD.width}
                y2={b.y + 0.5}
                stroke="#FFF8D6"
                strokeWidth={0.8}
                opacity={0.85}
              />
              <Line
                x1={0}
                y1={b.y + b.h - 0.4}
                x2={BOARD.width}
                y2={b.y + b.h - 0.4}
                stroke="#6E4E05"
                strokeWidth={0.8}
                opacity={0.7}
              />
            </G>
          ),
        )}
        {/* Rounded-cloth shading over the whole board */}
        <Rect x={0} y={0} width={BOARD.width} height={BOARD.height + 2} fill={`url(#${id('shade')})`} />
      </G>

      {/* Edge */}
      <Path d={BOARD_PATH} fill="none" stroke="#000000" strokeOpacity={0.55} strokeWidth={1.2} />
      <Path
        d={BOARD_PATH}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.07}
        strokeWidth={0.8}
        transform="translate(32,65) scale(0.94) translate(-32,-65)"
      />

      {/* Button */}
      <G>
        <Rect
          x={27.5}
          y={7.5}
          width={9}
          height={9}
          rx={4.5}
          fill="#5A4005"
          opacity={0.6}
          transform="translate(0,0.8)"
        />
        <Rect
          x={27.5}
          y={7.5}
          width={9}
          height={9}
          rx={4.5}
          fill={`url(#${id('goldH')})`}
          stroke="#7A5606"
          strokeWidth={0.6}
        />
        <Rect
          x={29.8}
          y={9.8}
          width={4.4}
          height={4.4}
          rx={2.2}
          fill="none"
          stroke="#7A5606"
          strokeWidth={0.5}
          opacity={0.7}
        />
      </G>

      {insignia.diamond && circle ? (
        <G transform={`translate(0,${diamondY})`}>
          <Circle
            cx={32.8}
            cy={0.6}
            r={RING_MID}
            stroke="#3D2B03"
            strokeWidth={RING_OUTER - RING_INNER}
            opacity={0.45}
            fill="none"
          />
          <Circle
            cx={32}
            cy={0}
            r={RING_MID}
            stroke={`url(#${id('goldH')})`}
            strokeWidth={RING_OUTER - RING_INNER}
            fill="none"
          />
          <Circle cx={32} cy={0} r={RING_OUTER} stroke="#7A5606" strokeWidth={0.7} fill="none" />
          <Circle cx={32} cy={0} r={RING_INNER} stroke="#7A5606" strokeWidth={0.7} fill="none" />
          {/* Embroidery thread around the middle of the ring, and a highlight. */}
          <Circle
            cx={32}
            cy={0}
            r={RING_MID}
            stroke="#8A6206"
            strokeWidth={0.5}
            opacity={0.5}
            fill="none"
            strokeDasharray="1.2 1.2"
          />
          <Path
            d={`M${32 - RING_OUTER + 1.6},-3 A${RING_OUTER - 1.6},${RING_OUTER - 1.6} 0 0 1 32,${-RING_OUTER + 1.6}`}
            stroke="#FFF6CC"
            strokeWidth={0.9}
            opacity={0.75}
            fill="none"
          />
        </G>
      ) : null}
      {insignia.diamond && !circle ? (
        <G transform={`translate(0,${diamondY})`}>
          <Path
            d={`${DIAMOND_OUTER} ${DIAMOND_INNER}`}
            fillRule="evenodd"
            fill="#3D2B03"
            opacity={0.5}
            transform="translate(0.8,0.6)"
          />
          <Path
            d={`${DIAMOND_OUTER} ${DIAMOND_INNER}`}
            fillRule="evenodd"
            fill={`url(#${id('goldH')})`}
            stroke="#7A5606"
            strokeWidth={0.7}
          />
          <Path d={DIAMOND_FACETS} stroke="#8A6206" strokeWidth={0.6} opacity={0.6} fill="none" />
          <Path d="M32,-15.2 L47.2,0" stroke="#FFF6CC" strokeWidth={0.9} opacity={0.8} fill="none" />
          <Path d="M32,-15.2 L16.8,0" stroke="#FFF6CC" strokeWidth={0.6} opacity={0.5} fill="none" />
        </G>
      ) : null}
    </Svg>
  );
}

/** The epaulette, or a quiet placeholder board when the rank has none. */
export function RankBadge({ insignia, size = 64 }: { insignia: Insignia | null; size?: number }) {
  const colors = useTheme();
  if (insignia) return <Epaulette insignia={insignia} size={size} />;
  return (
    <View
      style={{
        width: size / 2,
        height: size,
        borderRadius: size / 6,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="person" size={size / 5} color={colors.textMuted} />
    </View>
  );
}

const stripeLabel = (n: number) => (n === 0.5 ? '½' : String(n));

/** Edits one rank's epaulette: stripes, distinction cloth and diamond. */
export function InsigniaEditorModal({
  rankId,
  rankName,
  value,
  onClose,
  onSave,
}: {
  rankId: string;
  rankName: string;
  value: Insignia | null;
  onClose: () => void;
  onSave: (insignia: Insignia | null) => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const fallback = DEFAULT_INSIGNIA[rankId] ?? { stripes: 1, cloth: 'none' as InsigniaCloth, diamond: true };
  const [has, setHas] = useState(value !== null);
  const [draft, setDraft] = useState<Insignia>(value ?? fallback);
  const defaults = DEFAULT_INSIGNIA[rankId];
  const set = (patch: Partial<Insignia>) => setDraft((d) => ({ ...d, ...patch }));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const emblem: 'none' | InsigniaEmblem = !draft.diamond ? 'none' : (draft.emblem ?? 'diamond');
  const custom = isCustomCloth(draft.cloth) ? draft.cloth : null;
  // The palette's colour stays on its swatch until another is picked there.
  const [picked, setPicked] = useState<string | null>(custom);

  const namedSwatch = (c: NamedCloth) => {
    const on = draft.cloth === c;
    return (
      <Pressable key={c} onPress={() => set({ cloth: c })} style={styles.swatchItem}>
        <View style={[styles.swatchRing, { borderColor: on ? colors.primary : 'transparent' }]}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: c === 'none' ? '#1A2540' : CLOTH_COLORS[c], borderColor: colors.border },
            ]}
          >
            {c === 'none' ? <Ionicons name="remove" size={16} color="#E8B730" /> : null}
            {on && c !== 'none' ? (
              <Ionicons name="checkmark" size={16} color={c === 'white' ? '#12212E' : '#FFFFFF'} />
            ) : null}
          </View>
        </View>
        <Text style={{ color: on ? colors.primary : colors.textMuted, fontSize: 11 }} numberOfLines={1}>
          {t(`ranks.insignia.cloths.${c}`)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {rankName}
            </Text>

            <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
              {has ? (
                <View style={styles.pair}>
                  <Epaulette insignia={draft} size={150} />
                  <Epaulette insignia={draft} size={150} />
                </View>
              ) : (
                <RankBadge insignia={null} size={150} />
              )}
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.text }]}>{t('ranks.insignia.has')}</Text>
              <Switch
                value={has}
                onValueChange={setHas}
                trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                thumbColor={has ? colors.primary : colors.surfaceMuted}
              />
            </View>

            {has ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>{t('ranks.insignia.stripes')}</Text>
                <View style={styles.chips}>
                  {STRIPE_OPTIONS.map((n) => {
                    const on = draft.stripes === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => set({ stripes: n })}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: on ? colors.primary : colors.surfaceMuted,
                            borderColor: on ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '700' }}>
                          {stripeLabel(n)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.textMuted }]}>{t('ranks.insignia.cloth')}</Text>
                <View style={styles.swatches}>
                  {CLOTH_OPTIONS.slice(0, 3).map(namedSwatch)}
                  {/* Any other colour, from the palette. */}
                  <Pressable onPress={() => setPaletteOpen(true)} style={styles.swatchItem}>
                    <View style={[styles.swatchRing, { borderColor: custom ? colors.primary : 'transparent' }]}>
                      {picked ? (
                        <View style={[styles.swatch, { backgroundColor: picked, borderColor: colors.border }]}>
                          <Ionicons name="color-palette" size={15} color={isLight(picked) ? '#12212E' : '#FFFFFF'} />
                        </View>
                      ) : (
                        <View style={[styles.swatch, styles.rainbow, { borderColor: colors.border }]}>
                          {RAINBOW.map((c) => (
                            <View key={c} style={{ flex: 1, backgroundColor: c }} />
                          ))}
                        </View>
                      )}
                    </View>
                    <Text style={{ color: custom ? colors.primary : colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                      {t('ranks.insignia.cloths.custom')}
                    </Text>
                  </Pressable>
                  {CLOTH_OPTIONS.slice(3).map(namedSwatch)}
                </View>

                <Text style={[styles.label, { color: colors.textMuted }]}>{t('ranks.insignia.emblem')}</Text>
                <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
                  {(['none', 'diamond', 'circle'] as const).map((e) => {
                    const on = emblem === e;
                    return (
                      <Pressable
                        key={e}
                        onPress={() =>
                          e === 'none'
                            ? set({ diamond: false })
                            : set({ diamond: true, emblem: e === 'circle' ? 'circle' : undefined })
                        }
                        style={[styles.segmentItem, on && { backgroundColor: colors.surface }]}
                      >
                        <EmblemGlyph kind={e} color={on ? colors.primary : colors.textMuted} />
                        <Text
                          style={{ color: on ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: '700' }}
                        >
                          {t(`ranks.insignia.emblems.${e}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {defaults ? (
              <Pressable
                onPress={() => {
                  setHas(true);
                  setDraft(defaults);
                }}
                style={styles.reset}
                hitSlop={6}
              >
                <Ionicons name="refresh" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('ranks.insignia.reset')}</Text>
              </Pressable>
            ) : null}

            {paletteOpen ? (
              <ColorPaletteModal
                value={picked ?? '#1D4F91'}
                onClose={() => setPaletteOpen(false)}
                onPick={(c) => {
                  setPicked(c);
                  set({ cloth: c });
                  setPaletteOpen(false);
                }}
              />
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => onSave(has ? draft : null)}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const RAINBOW = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA'];

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

function hslToHex(h: number, s: number, l: number): `#${string}` {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase() as `#${string}`;
}

/** 12 hues × 6 shades, plus a grey row. */
const PALETTE: `#${string}`[][] = [
  ...[0.22, 0.3, 0.4, 0.5, 0.62, 0.75].map((l) => Array.from({ length: 12 }, (_, i) => hslToHex(i * 30, 0.72, l))),
  Array.from({ length: 12 }, (_, i) => hslToHex(0, 0, 0.08 + (i * 0.84) / 11)),
];

/** A colour palette with a live preview and an exact HEX field. */
function ColorPaletteModal({
  value,
  onClose,
  onPick,
}: {
  value: string;
  onClose: () => void;
  onPick: (color: `#${string}`) => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const [color, setColor] = useState(value.toUpperCase());
  const [hex, setHex] = useState(value.toUpperCase());
  const valid = /^#[0-9A-F]{6}$/.test(color);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, gap: Spacing.md }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('ranks.insignia.cloths.custom')}</Text>
          <View style={styles.paletteGrid}>
            {PALETTE.map((row, r) => (
              <View key={r} style={styles.paletteRow}>
                {row.map((c) => {
                  const on = c === color;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setColor(c);
                        setHex(c);
                      }}
                      style={[
                        styles.paletteCell,
                        { backgroundColor: c },
                        on && {
                          borderWidth: 2.5,
                          borderColor: '#000000',
                          transform: [{ scale: 1.15 }],
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.hexRow}>
            <View
              style={[
                styles.hexPreview,
                { backgroundColor: valid ? color : 'transparent', borderColor: colors.border },
              ]}
            />
            <TextInput
              value={hex}
              onChangeText={(v) => {
                const next = (v.startsWith('#') ? v : `#${v}`).toUpperCase().slice(0, 7);
                setHex(next);
                if (/^#[0-9A-F]{6}$/.test(next)) setColor(next);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={[
                styles.hexInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
              ]}
            />
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              disabled={!valid}
              onPress={() => onPick(color as `#${string}`)}
              style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: valid ? 1 : 0.5 }]}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t('common.confirm')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Small drawing of an emblem choice for the selector. */
function EmblemGlyph({ kind, color }: { kind: 'none' | InsigniaEmblem; color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      {kind === 'diamond' ? (
        <Path
          d="M10,1.5 L18.5,10 L10,18.5 L1.5,10 Z M10,6.5 L13.5,10 L10,13.5 L6.5,10 Z"
          fill={color}
          fillRule="evenodd"
        />
      ) : kind === 'circle' ? (
        <Circle cx={10} cy={10} r={6.5} stroke={color} strokeWidth={3.5} fill="none" />
      ) : (
        <Path d="M4,4 L16,16 M16,4 L4,16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 3, gap: 3 },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },
  rainbow: { flexDirection: 'row', overflow: 'hidden', borderWidth: 0 },
  paletteGrid: { gap: 4, direction: 'ltr' },
  paletteRow: { flexDirection: 'row', gap: 4 },
  paletteCell: { flex: 1, aspectRatio: 1, borderRadius: 5 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, direction: 'ltr' },
  hexPreview: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  backdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: Spacing.xl },
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg, maxHeight: '90%' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  preview: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  pair: { flexDirection: 'row', gap: Spacing.xl },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: {
    minWidth: 40,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.sm },
  swatchItem: { width: '33.33%', alignItems: 'center', gap: 2 },
  swatchRing: { borderWidth: 2, borderRadius: Radius.full, padding: 2 },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md },
});
