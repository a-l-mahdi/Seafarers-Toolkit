import { useId, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';

export interface ChartPoint {
  key: string;
  value: number;
  /** Text drawn above the point. */
  above?: string;
  /** Text drawn below the point. */
  below?: string;
}

const PAD_LEFT = 40;
const PAD_RIGHT = 28;
const PAD_TOP = 34;
const PAD_BOTTOM = 34;
const LABEL_WIDTH = 92;
/** Below this spacing, labels would collide: show them for the selected point only. */
const MIN_LABEL_STEP = 58;
const TICKS = 4;

/** "Nice" axis top and step (1, 2, 2.5, 5 × 10ⁿ) covering `max`. */
function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: TICKS, step: 1 };
  const raw = max / TICKS;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { top: step * TICKS, step };
}

/** Smooth path through the points without overshooting (monotone cubic, Fritsch–Carlson). */
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (tangent[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (tangent[i + 1] * dx[i]) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * Smooth area line chart. The curve starts from a zero point at the left edge,
 * then passes through each data point; spacing adapts to the number of points.
 * Points are tappable; labels (above/below) show for every point when there is
 * room, otherwise only for the selected one. Always laid out left-to-right.
 */
export function LineChart({
  points,
  unit,
  selectedKey,
  onSelect,
  labels = 'all',
  focusSelected = false,
  height = 240,
  color,
}: {
  points: ChartPoint[];
  /** Small caption above the y axis (e.g. "months"). */
  unit?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  labels?: 'all' | 'selected';
  /** While a point is selected, fade the others and show only its labels. */
  focusSelected?: boolean;
  height?: number;
  color?: string;
}) {
  const colors = useTheme();
  const stroke = color ?? colors.primary;
  const gradientId = `grad-${useId().replace(/:/g, '')}`;
  const [width, setWidth] = useState(0);

  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const { top, step: tickStep } = niceScale(Math.max(0, ...points.map((p) => p.value)));
  const count = points.length + 1; // + the zero origin
  const step = width > 0 ? (width - PAD_LEFT - PAD_RIGHT) / (count - 1) : 0;
  const xAt = (i: number) => PAD_LEFT + i * step;
  const yAt = (v: number) => baseY - (v / top) * plotH;

  const xs = [xAt(0), ...points.map((_, i) => xAt(i + 1))];
  const ys = [baseY, ...points.map((p) => yAt(p.value))];
  const line = smoothPath(xs, ys);
  const area = `${line} L${xs[xs.length - 1]},${baseY} L${xs[0]},${baseY} Z`;
  const focusing = focusSelected && points.some((p) => p.key === selectedKey);
  const showAll = labels === 'all' && step >= MIN_LABEL_STEP && !focusing;
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => i * tickStep);

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                <Stop offset="1" stopColor={stroke} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {/* Dashed y axis + baseline, faint grid lines. */}
            {ticks.slice(1).map((v) => (
              <Line
                key={v}
                x1={PAD_LEFT}
                x2={width - PAD_RIGHT / 2}
                y1={yAt(v)}
                y2={yAt(v)}
                stroke={colors.border}
                strokeWidth={StyleSheet.hairlineWidth}
              />
            ))}
            <Line x1={PAD_LEFT} x2={PAD_LEFT} y1={PAD_TOP - 8} y2={baseY} stroke={colors.textMuted} strokeDasharray="4 4" strokeWidth={1} />
            <Line x1={PAD_LEFT} x2={width - PAD_RIGHT / 2} y1={baseY} y2={baseY} stroke={colors.textMuted} strokeDasharray="4 4" strokeWidth={1} />

            <Path d={area} fill={`url(#${gradientId})`} />
            <Path d={line} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

            <Circle cx={xs[0]} cy={baseY} r={4} fill={stroke} />
            {points.map((p, i) => {
              const selected = p.key === selectedKey;
              return (
                <Circle
                  key={`halo-${p.key}`}
                  cx={xs[i + 1]}
                  cy={ys[i + 1]}
                  r={selected ? 13 : 0}
                  fill={stroke}
                  opacity={0.18}
                />
              );
            })}
            {points.map((p, i) => {
              const selected = p.key === selectedKey;
              return (
                <Circle
                  key={p.key}
                  cx={xs[i + 1]}
                  cy={ys[i + 1]}
                  r={selected ? 7 : 5.5}
                  fill={stroke}
                  opacity={focusing && !selected ? 0.3 : 1}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>

          {/* Y-axis values */}
          {ticks.map((v) => (
            <Text key={`t-${v}`} style={[styles.tick, { top: yAt(v) - 8, color: colors.textMuted }]}>
              {formatTick(v)}
            </Text>
          ))}
          {unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text> : null}

          {/* Point labels and tap targets */}
          {points.map((p, i) => {
            const x = xs[i + 1];
            const y = ys[i + 1];
            const selected = p.key === selectedKey;
            const visible = showAll || selected;
            const left = Math.min(Math.max(x - LABEL_WIDTH / 2, 0), width - LABEL_WIDTH);
            return (
              <View key={`l-${p.key}`} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {visible && p.above ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      styles.above,
                      { left, top: y - 30, color: selected ? stroke : colors.text },
                    ]}
                  >
                    {p.above}
                  </Text>
                ) : null}
                {visible && p.below ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.label, { left, top: y + 12, color: colors.textMuted }]}
                  >
                    {p.below}
                  </Text>
                ) : null}
                {onSelect ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={[p.above, p.below].filter(Boolean).join(' · ')}
                    onPress={() => onSelect(p.key)}
                    hitSlop={6}
                    style={[styles.hit, { left: x - 22, top: y - 22 }]}
                  />
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Charts read left → right (time axis) in both layout directions.
  root: { direction: 'ltr', alignSelf: 'stretch' },
  tick: { position: 'absolute', left: 0, width: PAD_LEFT - 8, textAlign: 'right', fontSize: 11 },
  unit: { position: 'absolute', left: 0, top: 4, width: PAD_LEFT + 30, fontSize: 11, fontWeight: '600' },
  label: { position: 'absolute', width: LABEL_WIDTH, textAlign: 'center', fontSize: 12 },
  above: { fontWeight: '700' },
  hit: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
});
