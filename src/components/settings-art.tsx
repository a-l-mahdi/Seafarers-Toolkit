import { useId } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/** The app icon's ocean blues, deep → pale. */
export const BRAND = {
  deep: '#0A3D91',
  main: '#0254B6',
  bright: '#2E8BEF',
  light: '#7CC4FF',
  pale: '#DCEBFF',
} as const;

function useSvgId(name: string): string {
  return `${name}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** A speech bubble on an ocean tile, with the language's own letters. */
export function LanguageArt({ glyph, size = 56 }: { glyph: string; size?: number }) {
  const bg = useSvgId('lang');
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
      </Defs>
      <Rect width={56} height={56} rx={17} fill={`url(#${bg})`} />
      <Path
        d="M14 15h28a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H27l-7 6v-6h-6a5 5 0 0 1-5-5V20a5 5 0 0 1 5-5z"
        fill="#FFFFFF"
        opacity={0.96}
      />
      <SvgText x={28} y={32.5} fontSize={14} fontWeight="800" fill={BRAND.main} textAnchor="middle">
        {glyph}
      </SvgText>
    </Svg>
  );
}

/** A desk-calendar page showing today's day in the given calendar. */
export function CalendarArt({ day, caption, size = 56 }: { day: string; caption: string; size?: number }) {
  const band = useSvgId('cal');
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Defs>
        <LinearGradient id={band} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.main} />
        </LinearGradient>
      </Defs>
      <Rect x={6} y={8} width={44} height={44} rx={10} fill="#FFFFFF" stroke={BRAND.pale} strokeWidth={1.5} />
      <Path d="M6 18a10 10 0 0 1 10-10h24a10 10 0 0 1 10 10v2H6z" fill={`url(#${band})`} />
      <Rect x={16} y={4} width={4} height={10} rx={2} fill={BRAND.deep} />
      <Rect x={36} y={4} width={4} height={10} rx={2} fill={BRAND.deep} />
      <SvgText x={28} y={40} fontSize={17} fontWeight="800" fill={BRAND.deep} textAnchor="middle">
        {day}
      </SvgText>
      <SvgText x={28} y={48.5} fontSize={7} fontWeight="700" fill={BRAND.bright} textAnchor="middle">
        {caption}
      </SvgText>
    </Svg>
  );
}

type Palette = { bg: string; surface: string; line: string; text: string; accent: string; frame: string };

const LIGHT: Palette = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  line: '#DDE5EC',
  text: '#C3CFDA',
  accent: BRAND.main,
  frame: '#CFD9E3',
};
const DARK: Palette = {
  bg: '#0D141B',
  surface: '#16202B',
  line: '#253443',
  text: '#34475A',
  accent: '#5FA8E8',
  frame: '#2B3B4B',
};

/** Screen content of the mini app preview (80 × 120 viewBox). */
function MiniScreen({ p, hero }: { p: Palette; hero: string }) {
  return (
    <G>
      <Rect x={0} y={0} width={80} height={120} rx={13} fill={p.bg} />
      {/* header */}
      <Circle cx={12} cy={12} r={4} fill={p.text} />
      <Rect x={20} y={10} width={26} height={4} rx={2} fill={p.text} />
      {/* hero card */}
      <Rect x={7} y={22} width={66} height={30} rx={8} fill={`url(#${hero})`} />
      <Rect x={13} y={29} width={22} height={4} rx={2} fill="#FFFFFF" opacity={0.9} />
      <Rect x={13} y={37} width={34} height={7} rx={3} fill="#FFFFFF" />
      <Circle cx={62} cy={31} r={5} fill="#FFFFFF" opacity={0.25} />
      {/* list rows */}
      {[58, 76].map((y) => (
        <G key={y}>
          <Rect x={7} y={y} width={66} height={14} rx={5} fill={p.surface} stroke={p.line} strokeWidth={0.8} />
          <Circle cx={15} cy={y + 7} r={3.5} fill={p.accent} opacity={0.8} />
          <Rect x={22} y={y + 4} width={28} height={3} rx={1.5} fill={p.text} />
          <Rect x={22} y={y + 9} width={18} height={2} rx={1} fill={p.line} />
        </G>
      ))}
      {/* tab bar */}
      <Rect x={10} y={100} width={60} height={13} rx={6.5} fill={p.surface} stroke={p.line} strokeWidth={0.8} />
      <Circle cx={22} cy={106.5} r={2.5} fill={p.accent} />
      <Circle cx={34} cy={106.5} r={2} fill={p.text} />
      <Circle cx={46} cy={106.5} r={2} fill={p.text} />
      <Circle cx={58} cy={106.5} r={2} fill={p.text} />
    </G>
  );
}

/** A tiny phone screen in light, dark, or split (follow system) look. */
export function ThemePreview({ mode, width = 72 }: { mode: 'light' | 'dark' | 'system'; width?: number }) {
  const heroLight = useSvgId('heroL');
  const heroDark = useSvgId('heroD');
  const clip = useSvgId('clip');
  const height = width * 1.5;
  return (
    <Svg width={width} height={height} viewBox="-2 -2 84 124">
      <Defs>
        <LinearGradient id={heroLight} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
        <LinearGradient id={heroDark} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1C5FA8" />
          <Stop offset="1" stopColor="#03264A" />
        </LinearGradient>
        <ClipPath id={clip}>
          <Path d="M80 0 L80 120 L0 120 Z" />
        </ClipPath>
      </Defs>
      {mode === 'dark' ? <MiniScreen p={DARK} hero={heroDark} /> : <MiniScreen p={LIGHT} hero={heroLight} />}
      {mode === 'system' ? (
        <G clipPath={`url(#${clip})`}>
          <MiniScreen p={DARK} hero={heroDark} />
        </G>
      ) : null}
      <Rect
        x={0}
        y={0}
        width={80}
        height={120}
        rx={13}
        fill="none"
        stroke={mode === 'dark' ? DARK.frame : LIGHT.frame}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** Backup illustration: a data store guarded by a shield, on a soft ocean halo. */
export function BackupArt({ size = 84 }: { size?: number }) {
  const body = useSvgId('db');
  const shield = useSvgId('shield');
  return (
    <Svg width={size} height={size} viewBox="0 0 84 84">
      <Defs>
        <LinearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.main} />
        </LinearGradient>
        <LinearGradient id={shield} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BRAND.main} />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
      </Defs>
      <Circle cx={42} cy={42} r={41} fill={BRAND.pale} opacity={0.55} />
      <Circle cx={42} cy={42} r={31} fill={BRAND.pale} />
      {/* data store: three stacked discs */}
      <Path d="M20 26v30c0 4.4 8.5 8 19 8s19-3.6 19-8V26z" fill={`url(#${body})`} />
      <Ellipse cx={39} cy={26} rx={19} ry={7.5} fill={BRAND.light} />
      <Ellipse cx={39} cy={26} rx={12} ry={4.2} fill="#FFFFFF" opacity={0.45} />
      <Path
        d="M20 36c0 4.4 8.5 8 19 8s19-3.6 19-8"
        stroke="#FFFFFF"
        strokeOpacity={0.55}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M20 46c0 4.4 8.5 8 19 8s19-3.6 19-8"
        stroke="#FFFFFF"
        strokeOpacity={0.55}
        strokeWidth={1.6}
        fill="none"
      />
      <Circle cx={27} cy={41} r={1.6} fill="#FFFFFF" />
      <Circle cx={27} cy={51} r={1.6} fill="#FFFFFF" />
      {/* shield */}
      <Path
        d="M60 44l12 4.5v8.5c0 7.6-5.2 13.4-12 15.5-6.8-2.1-12-7.9-12-15.5v-8.5z"
        fill={`url(#${shield})`}
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path
        d="M54.5 57.5l4 4 7.5-8"
        stroke="#FFFFFF"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Round ocean badge with an arrow into (backup) or out of a tray, or a circular restore arrow. */
export function ActionArt({ kind, size = 44 }: { kind: 'backup' | 'restore' | 'file'; size?: number }) {
  const bg = useSvgId('act');
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
      </Defs>
      <Circle cx={22} cy={22} r={22} fill={`url(#${bg})`} />
      {kind === 'backup' ? (
        <G stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M22 27V12" />
          <Path d="M16 18l6-6 6 6" />
          <Path d="M12 25v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4" />
        </G>
      ) : kind === 'restore' ? (
        <G stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M13.5 22a8.5 8.5 0 1 0 2.5-6" />
          <Path d="M13 11v5.5h5.5" />
          <Path d="M22 18v4.5l3 2" />
        </G>
      ) : (
        <G stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M16 11h8l6 6v14a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" />
          <Path d="M24 11v6h6" />
          <Path d="M18 25h8M18 29h5" />
        </G>
      )}
    </Svg>
  );
}

/** Padlock badge for the backup-password dialog. */
export function LockArt({ size = 56 }: { size?: number }) {
  const bg = useSvgId('lock');
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={BRAND.bright} />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
      </Defs>
      <Circle cx={28} cy={28} r={28} fill={BRAND.pale} />
      <Path d="M20 25v-4a8 8 0 0 1 16 0v4" stroke={BRAND.main} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Rect x={15} y={24} width={26} height={20} rx={6} fill={`url(#${bg})`} />
      <Circle cx={28} cy={32.5} r={2.8} fill="#FFFFFF" />
      <Rect x={26.8} y={33} width={2.4} height={6} rx={1.2} fill="#FFFFFF" />
    </Svg>
  );
}
