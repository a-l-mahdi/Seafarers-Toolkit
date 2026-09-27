// The CV is an English document: this preview uses React Native's own Text
// (not the app's Persian-digit Text) so it shows exactly what gets exported.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { APP_ICON_JPEG_BASE64 } from '@/constants/app-icon';
import {
  CELL_PAD_PX,
  cellFill,
  COL_PX,
  PAGE_MARGIN_MM,
  ptToPx,
  SHEET_PX,
  STYLES,
  type Border,
  type Cell,
  type CellStyle,
  type CvSheet,
  type Row,
} from '@/services/cv-layout';

const ICON = { uri: `data:image/jpeg;base64,${APP_ICON_JPEG_BASE64}` };
const BORDER_PX: Record<Border['weight'], number> = { thin: 1, medium: 2, thick: 4 };
const MM_PX = 96 / 25.4;
/** A4 page in px at 96 dpi. */
const PAGE_W = 210 * MM_PX;
const PAGE_H = 297 * MM_PX;

/** Splits the rows into printed pages at the breaks the exports use. */
export function pagesOf(sheet: CvSheet): Row[][] {
  const pages: Row[][] = [[]];
  for (const row of sheet.rows) {
    if (row.pageBreakBefore && pages[pages.length - 1].length) pages.push([]);
    pages[pages.length - 1].push(row);
  }
  return pages;
}

/** The width of an A4 page that fits inside a width × height box. */
export function fitPageWidth(width: number, height: number): number {
  return Math.min(width, (height * PAGE_W) / PAGE_H);
}

/** The CV drawn as A4 sheets of paper, scaled to `width`. */
export function CvPreview({
  sheet,
  width,
  photoUri,
  onPagePress,
}: {
  sheet: CvSheet;
  width: number;
  photoUri: string | null;
  onPagePress?: (page: number) => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      {pagesOf(sheet).map((rows, p) => (
        <Pressable key={p} onPress={() => onPagePress?.(p)}>
          <CvPage sheet={sheet} rows={rows} first={p === 0} width={width} photoUri={photoUri} />
        </Pressable>
      ))}
    </View>
  );
}

/** One A4 page of the CV, `width` wide. */
export function CvPage({
  sheet,
  rows,
  first,
  width,
  photoUri,
}: {
  sheet: CvSheet;
  rows: Row[];
  /** The first page carries the header images. */
  first: boolean;
  width: number;
  photoUri: string | null;
}) {
  const s = width / PAGE_W;
  const side = ((PAGE_W - SHEET_PX) / 2) * s;

  return (
    <View style={[styles.page, { width, height: PAGE_H * s, paddingTop: PAGE_MARGIN_MM.top * MM_PX * s }]}>
      <View style={{ marginLeft: side, width: SHEET_PX * s }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', height: ptToPx(row.height) * s }}>
            {row.cells.map((cell, k) => (
              <CellView key={k} cell={cell} s={s} />
            ))}
          </View>
        ))}
        {first
          ? sheet.images.map((img) => {
              const source = img.kind === 'icon' ? ICON : photoUri ? { uri: photoUri } : null;
              if (!source) return null;
              return (
                <Image
                  key={img.kind}
                  source={source}
                  contentFit="cover"
                  style={{
                    position: 'absolute',
                    left: img.x * s,
                    top: img.y * s,
                    width: img.width * s,
                    height: img.height * s,
                    borderRadius: img.radius * s,
                    borderWidth: img.kind === 'photo' ? Math.max(1, 2 * s) : 0,
                    borderColor: '#FFFFFF',
                  }}
                />
              );
            })
          : null}
      </View>
    </View>
  );
}

function CellView({ cell, s }: { cell: Cell; s: number }) {
  const style = STYLES[cell.style] as CellStyle;
  const fill = cellFill(cell);
  const border = (b: Border | undefined) => (b ? Math.max(StyleSheet.hairlineWidth, BORDER_PX[b.weight] * s) : 0);
  const id = `g${cell.col}-${cell.span}-${cell.style}`;
  const justify = style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center';

  return (
    <View
      style={{
        width: cell.span * COL_PX * s,
        backgroundColor: typeof fill === 'string' ? fill : undefined,
        justifyContent: justify,
        paddingHorizontal: CELL_PAD_PX * s,
        overflow: 'hidden',
        borderTopWidth: border(style.top),
        borderTopColor: style.top?.color,
        borderBottomWidth: border(style.bottom),
        borderBottomColor: style.bottom?.color,
        borderLeftWidth: border(style.left),
        borderLeftColor: style.left?.color,
      }}
    >
      {fill && typeof fill !== 'string' ? (
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={fill.from} />
              <Stop offset="1" stopColor={fill.to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
        </Svg>
      ) : null}
      {cell.text ? (
        <Text
          style={{
            fontSize: ptToPx(style.size) * s,
            lineHeight: ptToPx(style.size) * s * 1.25,
            color: style.color,
            fontWeight: style.bold ? '700' : '400',
            fontStyle: style.italic ? 'italic' : 'normal',
            textAlign: style.align ?? 'left',
            letterSpacing: (style.spacing ?? 0) * s,
            writingDirection: 'ltr',
          }}
        >
          {style.upper ? cell.text.toUpperCase() : cell.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
    direction: 'ltr',
    elevation: 3,
    shadowColor: '#0B2340',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
