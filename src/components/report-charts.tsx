import { useId, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

function gradientId(raw: string, name: string): string {
  return `${name}-${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export interface Slice {
  key: string;
  value: number;
  color: string;
}

/**
 * Donut chart: one arc per slice with a small gap between them; the selected
 * slice is drawn thicker. Whatever is passed as children sits in the hole.
 */
export function DonutChart({
  slices,
  size = 164,
  thickness = 20,
  selectedKey,
  onSelect,
  children,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  children?: ReactNode;
}) {
  const colors = useTheme();
  const total = slices.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  const r = (size - thickness - 8) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const visible = slices.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? Math.min(6, circumference * 0.012) : 0;

  const arcs = visible.map((s, i) => {
    const before = visible.slice(0, i).reduce((sum, p) => sum + p.value, 0);
    return {
      ...s,
      offset: (before / total) * circumference,
      length: Math.max((s.value / total) * circumference - gap, 1),
    };
  });

  return (
    <View style={{ width: size, height: size, direction: 'ltr' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={colors.surfaceMuted} strokeWidth={thickness} fill="none" />
        <G rotation={-90} origin={`${c}, ${c}`}>
          {arcs.map((a) => {
            const active = a.key === selectedKey;
            const dim = !!selectedKey && !active;
            return (
              <Circle
                key={a.key}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={a.color}
                strokeOpacity={dim ? 0.35 : 1}
                strokeWidth={active ? thickness + 6 : thickness}
                strokeDasharray={`${a.length} ${circumference}`}
                strokeDashoffset={-a.offset}
                onPress={onSelect ? () => onSelect(a.key) : undefined}
              />
            );
          })}
        </G>
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        {children}
      </View>
    </View>
  );
}

/** A circular progress ring with content in the middle. */
export function RingProgress({
  progress,
  size = 120,
  thickness = 12,
  color,
  children,
}: {
  progress: number;
  size?: number;
  thickness?: number;
  color: string;
  children?: ReactNode;
}) {
  const colors = useTheme();
  const id = gradientId(useId(), 'ring');
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={{ width: size, height: size, direction: 'ltr' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={r} stroke={colors.surfaceMuted} strokeWidth={thickness} fill="none" />
        {p > 0 ? (
          <G rotation={-90} origin={`${c}, ${c}`}>
            <Circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={`url(#${id})`}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${p * circumference} ${circumference}`}
            />
          </G>
        ) : null}
      </Svg>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        {children}
      </View>
    </View>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Text above the bar (defaults to the value). */
  display?: string;
}

/**
 * Vertical bars with rounded tops and a soft gradient; tapping a bar
 * highlights it. Always laid out left-to-right (oldest → newest).
 */
export function BarChart({ bars, color, height = 190 }: { bars: Bar[]; color: string; height?: number }) {
  const colors = useTheme();
  const id = gradientId(useId(), 'bar');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const top = 22;
  const bottom = 26;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = bars.length ? width / bars.length : 0;
  const barW = Math.min(34, slot * 0.58);

  return (
    <View style={{ height, direction: 'ltr' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={color} stopOpacity={0.45} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={0}
              x2={width}
              y1={top + plotH * f}
              y2={top + plotH * f}
              stroke={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
              strokeDasharray={f === 1 ? undefined : '4 4'}
            />
          ))}
          {bars.map((b, i) => {
            const h = Math.max((b.value / max) * plotH, b.value > 0 ? 4 : 0);
            const x = slot * i + (slot - barW) / 2;
            const y = top + plotH - h;
            const dim = !!selected && selected !== b.key;
            return (
              <G key={b.key} onPress={() => setSelected((s) => (s === b.key ? null : b.key))}>
                {/* Wide transparent hit area */}
                <Rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={Math.min(8, barW / 2)}
                  fill={`url(#${id})`}
                  opacity={dim ? 0.35 : 1}
                />
                <SvgText
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize={11}
                  fontWeight="700"
                  fill={dim ? colors.textMuted : colors.text}
                  textAnchor="middle"
                >
                  {b.display ?? String(b.value)}
                </SvgText>
                <SvgText x={x + barW / 2} y={height - 8} fontSize={11} fill={colors.textMuted} textAnchor="middle">
                  {b.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

export interface Dot {
  key: string;
  value: number;
  /** Short label under the axis (e.g. a year). */
  label: string;
  /** Text in the bubble when the dot is selected. */
  display: string;
  /** Second line of the bubble (e.g. the vessel). */
  caption?: string;
}

/**
 * Dot plot of values over time: evenly spaced dots joined by a faint line, a
 * dashed average line, and a bubble for the tapped dot (the newest by default).
 */
export function DotChart({
  dots,
  color,
  height = 210,
  averageLabel,
}: {
  dots: Dot[];
  color: string;
  height?: number;
  averageLabel?: string;
}) {
  const colors = useTheme();
  const id = gradientId(useId(), 'dot');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? dots.at(-1)?.key ?? null;

  const padX = 22;
  const top = 58;
  const bottom = 28;
  const plotH = height - top - bottom;
  const values = dots.map((d) => d.value);
  const max = Math.max(1, ...values);
  const min = Math.min(...values, max);
  // Leave headroom below the lowest dot so small differences stay visible.
  const floor = Math.max(0, min - (max - min) * 0.6 - max * 0.05);
  const span = Math.max(max - floor, 1);
  const step = dots.length > 1 ? (width - padX * 2) / (dots.length - 1) : 0;
  const xAt = (i: number) => (dots.length > 1 ? padX + i * step : width / 2);
  const yAt = (v: number) => top + plotH - ((v - floor) / span) * plotH;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(d.value)}`).join(' ');
  const area = dots.length > 1 ? `${line} L${xAt(dots.length - 1)},${top + plotH} L${xAt(0)},${top + plotH} Z` : '';
  const showEvery = Math.max(1, Math.ceil(dots.length / 6));
  const activeIndex = dots.findIndex((d) => d.key === active);
  const activeDot = activeIndex >= 0 ? dots[activeIndex] : null;

  return (
    <View style={{ height, direction: 'ltr' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line
              x1={0}
              x2={width}
              y1={top + plotH}
              y2={top + plotH}
              stroke={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
            {area ? <Path d={area} fill={`url(#${id})`} /> : null}
            {dots.length > 1 ? <Path d={line} stroke={color} strokeOpacity={0.45} strokeWidth={2} fill="none" /> : null}
            {dots.length > 1 ? (
              <>
                <Line
                  x1={0}
                  x2={width}
                  y1={yAt(avg)}
                  y2={yAt(avg)}
                  stroke={colors.textMuted}
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
                {averageLabel ? (
                  <SvgText x={4} y={yAt(avg) - 5} fontSize={10} fill={colors.textMuted}>
                    {averageLabel}
                  </SvgText>
                ) : null}
              </>
            ) : null}
            {activeDot ? (
              <Line
                x1={xAt(activeIndex)}
                x2={xAt(activeIndex)}
                y1={yAt(activeDot.value)}
                y2={top + plotH}
                stroke={color}
                strokeOpacity={0.5}
                strokeDasharray="3 3"
              />
            ) : null}
            {dots.map((d, i) => {
              const on = d.key === active;
              return (
                <G key={d.key} onPress={() => setSelected(d.key)}>
                  <Rect x={xAt(i) - 18} y={0} width={36} height={height} fill="transparent" />
                  {on ? <Circle cx={xAt(i)} cy={yAt(d.value)} r={13} fill={color} fillOpacity={0.18} /> : null}
                  <Circle
                    cx={xAt(i)}
                    cy={yAt(d.value)}
                    r={on ? 7 : 5.5}
                    fill={on ? color : colors.surface}
                    stroke={color}
                    strokeWidth={on ? 3 : 2.5}
                  />
                  {i % showEvery === 0 || i === dots.length - 1 || on ? (
                    <SvgText
                      x={xAt(i)}
                      y={height - 8}
                      fontSize={10.5}
                      fontWeight={on ? '700' : '400'}
                      fill={on ? colors.text : colors.textMuted}
                      textAnchor="middle"
                    >
                      {d.label}
                    </SvgText>
                  ) : null}
                </G>
              );
            })}
          </Svg>
          {activeDot ? (
            <Bubble
              x={Math.min(Math.max(xAt(activeIndex), 70), width - 70)}
              title={activeDot.display}
              caption={activeDot.caption}
              color={color}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Bubble({ x, title, caption, color }: { x: number; title: string; caption?: string; color: string }) {
  return (
    <View pointerEvents="none" style={[styles.bubble, { left: x - 70, backgroundColor: color }]}>
      <Text style={styles.bubbleTitle} numberOfLines={1}>
        {title}
      </Text>
      {caption ? (
        <Text style={styles.bubbleCaption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Horizontal bar split into coloured parts (e.g. wage / travel / bonus). */
export function StackedBar({ parts, height = 12 }: { parts: Slice[]; height?: number }) {
  const colors = useTheme();
  const total = parts.reduce((sum, p) => sum + Math.max(p.value, 0), 0);
  return (
    <View style={[styles.stack, { height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted }]}>
      {total > 0
        ? parts
            .filter((p) => p.value > 0)
            .map((p) => <View key={p.key} style={{ flex: p.value / total, backgroundColor: p.color }} />)
        : null}
    </View>
  );
}

/** Tappable legend row: colour dot, label, value and share. */
export function LegendRow({
  color,
  label,
  value,
  share,
  active,
  onPress,
}: {
  color: string;
  label: string;
  value: string;
  share?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.legend, (active || pressed) && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.legendValue, { color: colors.text }]}>{value}</Text>
      {share ? <Text style={[styles.legendShare, { color: colors.textMuted }]}>{share}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bubble: {
    position: 'absolute',
    top: 4,
    width: 140,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  bubbleTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bubbleCaption: { color: '#FFFFFFCC', fontSize: 11, marginTop: 1 },
  stack: { flexDirection: 'row', overflow: 'hidden', gap: 2, direction: 'ltr' },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { flex: 1, fontSize: 14 },
  legendValue: { fontSize: 14, fontWeight: '700' },
  legendShare: { fontSize: 12, minWidth: 40, textAlign: 'right' },
});
