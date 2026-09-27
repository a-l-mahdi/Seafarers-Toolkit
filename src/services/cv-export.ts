import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import type { ReadyFile } from '@/services/file-share';
import { getProfile } from '@/database/repositories/profile-repository';
import { getCvProfile } from '@/database/repositories/cv-repository';
import { listDocuments } from '@/database/repositories/documents-repository';
import { listContracts, listVessels } from '@/database/repositories/vessels-repository';
import { listRanks } from '@/database/repositories/ranks-repository';
import { APP_ICON_JPEG_BASE64 } from '@/constants/app-icon';
import { DEFAULT_AVATAR_CV_URI } from '@/constants/default-avatar-cv';
import {
  buildCvSheet,
  cellFill,
  mix,
  COL_PX,
  COLS,
  PAGE_MARGIN_MM,
  CELL_PAD_PX,
  rowOffsets,
  SHEET_PX,
  STYLES,
  type Border,
  type CellStyle,
  type CvSheet,
  type CvSource,
} from '@/services/cv-layout';
import type { Profile, Vessel } from '@/types/domain';

// ExcelJS (via JSZip) expects a global Buffer, which React Native doesn't provide.
const globalScope = globalThis as unknown as { Buffer?: typeof Buffer };
if (!globalScope.Buffer) globalScope.Buffer = Buffer;

const ICON_URI = `data:image/jpeg;base64,${APP_ICON_JPEG_BASE64}`;

function esc(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The seafarer's photo, or the default seafarer portrait when there is none. */
async function photoDataUri(profile: Profile | null): Promise<string> {
  if (!profile?.photoPath) return DEFAULT_AVATAR_CV_URI;
  try {
    const info = await FileSystem.getInfoAsync(profile.photoPath);
    if (!info.exists) return DEFAULT_AVATAR_CV_URI;
    const b64 = await FileSystem.readAsStringAsync(profile.photoPath, { encoding: FileSystem.EncodingType.Base64 });
    const ext = profile.photoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${b64}`;
  } catch {
    return DEFAULT_AVATAR_CV_URI;
  }
}

// ---------------------------------------------------------------- PDF (HTML)

const BORDER_PX: Record<Border['weight'], number> = { thin: 1, medium: 2, thick: 4 };

function cssFor(style: CellStyle, fill: ReturnType<typeof cellFill>): string {
  const css: string[] = [
    `font-size:${style.size}pt`,
    `color:${style.color}`,
    `font-weight:${style.bold ? 'bold' : 'normal'}`,
    `text-align:${style.align ?? 'left'}`,
    `vertical-align:${style.valign ?? 'middle'}`,
  ];
  if (style.italic) css.push('font-style:italic');
  if (style.upper) css.push('text-transform:uppercase');
  if (style.spacing) css.push(`letter-spacing:${style.spacing}px`);
  if (typeof fill === 'string') css.push(`background:${fill}`);
  else if (fill) css.push(`background:linear-gradient(90deg,${fill.from},${fill.to})`);
  for (const side of ['top', 'bottom', 'left'] as const) {
    const b = style[side];
    if (b) css.push(`border-${side}:${BORDER_PX[b.weight]}px solid ${b.color}`);
  }
  return css.join(';');
}

/** The CV as an A4 HTML page: a fixed 24-column table plus absolutely placed images. */
export function renderCvHtml(sheet: CvSheet, photo: string | null): string {
  const cols = Array.from({ length: COLS }, () => `<col style="width:${COL_PX}px" />`).join('');
  const tr = (row: CvSheet['rows'][number]) =>
    `<tr style="height:${row.height}pt">${row.cells
      .map((cell) => {
        const style = STYLES[cell.style] as CellStyle;
        return `<td colspan="${cell.span}" style="${cssFor(style, cellFill(cell))}">${esc(cell.text).replace(/\n/g, '<br/>')}</td>`;
      })
      .join('')}</tr>`;
  // Rows that must stay with the next one share a <tbody> that is not split across pages.
  let body = '';
  let chunk = '';
  for (const row of sheet.rows) {
    if (row.pageBreakBefore && chunk) {
      body += `<tbody>${chunk}</tbody>`;
      chunk = '';
    }
    chunk += row.pageBreakBefore ? tr(row).replace('<tr ', '<tr class="break" ') : tr(row);
    if (!row.keepWithNext) {
      body += `<tbody>${chunk}</tbody>`;
      chunk = '';
    }
  }
  if (chunk) body += `<tbody>${chunk}</tbody>`;
  const imgs = sheet.images
    .map((img) => {
      const src = img.kind === 'icon' ? ICON_URI : photo;
      if (!src) return '';
      const frame = img.kind === 'photo' ? 'border:2px solid #FFFFFF;' : '';
      return `<img src="${src}" style="position:absolute;left:${img.x}px;top:${img.y}px;width:${img.width}px;height:${img.height}px;border-radius:${img.radius}px;object-fit:cover;${frame}" />`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: ${PAGE_MARGIN_MM.top}mm ${PAGE_MARGIN_MM.side}mm ${PAGE_MARGIN_MM.bottom}mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .sheet { position: relative; width: ${SHEET_PX}px; margin: 0 auto; }
  table { border-collapse: collapse; table-layout: fixed; width: ${SHEET_PX}px; }
  td { padding: 0 ${CELL_PAD_PX}px; line-height: 1.25; overflow: hidden; word-wrap: break-word; }
  tr, tbody { page-break-inside: avoid; break-inside: avoid; }
  tr.break td { break-before: page; page-break-before: always; }
  tbody:has(tr.break) { break-before: page; page-break-before: always; }
</style></head>
<body><div class="sheet"><table><colgroup>${cols}</colgroup>${body}</table>${imgs}</div></body></html>`;
}

// ---------------------------------------------------------------- Data

type LoadedCv = { source: CvSource; photo: string | null };

/** Everything the CV needs, with the documents the user excluded left out. */
async function loadCvData(): Promise<LoadedCv> {
  const [profile, cv, allDocuments, contracts, vessels, ranks] = await Promise.all([
    getProfile(),
    getCvProfile(),
    listDocuments(),
    listContracts(),
    listVessels(),
    listRanks(),
  ]);
  const excluded = new Set(cv.excludedDocumentIds ?? []);
  const vesselsByName = new Map<string, Vessel>();
  for (const v of vessels) vesselsByName.set(v.name, v);
  const photo = await photoDataUri(profile);
  return {
    photo,
    source: {
      profile,
      cv,
      documents: allDocuments.filter((d) => !excluded.has(d.id)),
      contracts,
      vesselsByName,
      currentRankName: ranks.find((r) => r.id === profile?.currentRankId)?.name ?? null,
      hasPhoto: !!photo,
    },
  };
}

/** The very first printToFileAsync after launch can fail while the print
 *  WebView cold-starts. Retry once after a short delay. */
async function printToFileWithRetry(html: string): Promise<string> {
  // A4 in points (the page size of the PDF).
  const options = { html, width: 595, height: 842 };
  try {
    return (await Print.printToFileAsync(options)).uri;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return (await Print.printToFileAsync(options)).uri;
  }
}

/** Renders the CV to a PDF and returns the file (the caller decides share/save). */
export async function exportCv(): Promise<ReadyFile> {
  const { source, photo } = await loadCvData();
  const uri = await printToFileWithRetry(renderCvHtml(buildCvSheet(source), photo));
  const dest = `${FileSystem.cacheDirectory ?? ''}Seafarer-CV-${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return { uri: dest, name: 'Seafarer-CV.pdf', mime: 'application/pdf' };
}

// ---------------------------------------------------------------- Excel

const argb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;
const EMU_PER_PX = 9525;
/** Excel column width (characters of the default font) for a width in px. */
const excelWidth = (px: number) => Math.round(((px - 5) / 7) * 100) / 100;

function xlBorder(b: Border | undefined): Partial<ExcelJS.Border> | undefined {
  return b ? { style: b.weight, color: { argb: argb(b.color) } } : undefined;
}

/** Builds the same grid as the PDF in a real .xlsx, returned as base64. */
export async function renderCvXlsxBase64(sheet: CvSheet, photo: string | null): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Seafarer's Toolkit";
  const ws = wb.addWorksheet('CV', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: PAGE_MARGIN_MM.side / 25.4,
        right: PAGE_MARGIN_MM.side / 25.4,
        top: PAGE_MARGIN_MM.top / 25.4,
        bottom: PAGE_MARGIN_MM.bottom / 25.4,
        header: 0.3,
        footer: 0.3,
      },
    },
  });
  ws.columns = Array.from({ length: COLS }, () => ({ width: excelWidth(COL_PX) }));

  sheet.rows.forEach((row, i) => {
    const r = i + 1;
    ws.getRow(r).height = row.height;
    if (row.pageBreakBefore && r > 1) ws.getRow(r - 1).addPageBreak();
    for (const cell of row.cells) {
      const style = STYLES[cell.style] as CellStyle;
      const fill = cellFill(cell);
      const text = style.upper ? cell.text.toUpperCase() : cell.text;
      // Style every cell of the range first so merged borders/fills are complete.
      for (let k = 0; k < cell.span; k += 1) {
        const x = ws.getCell(r, cell.col + 1 + k);
        x.font = {
          name: 'Arial',
          size: style.size,
          bold: !!style.bold,
          italic: !!style.italic,
          color: { argb: argb(style.color) },
        };
        x.alignment = {
          horizontal: style.align ?? 'left',
          vertical: style.valign === 'top' ? 'top' : style.valign === 'bottom' ? 'bottom' : 'middle',
          wrapText: true,
          indent: style.align === 'center' ? 0 : 1,
        };
        if (typeof fill === 'string') {
          x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(fill) } };
        } else if (fill) {
          // Gradient fills are blank in many viewers (mobile Excel, WPS, Sheets):
          // shade each column solid along the gradient instead.
          const tone = mix(fill.from, fill.to, (k + 0.5) / cell.span);
          x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(tone) } };
        }
        x.border = {
          top: xlBorder(style.top),
          bottom: xlBorder(style.bottom),
          left: k === 0 ? xlBorder(style.left) : undefined,
        };
      }
      if (cell.span > 1) ws.mergeCells(r, cell.col + 1, r, cell.col + cell.span);
      ws.getCell(r, cell.col + 1).value = text;
    }
  });

  // Images at the same pixel positions as in the PDF.
  const tops = rowOffsets(sheet);
  const anchor = (x: number, y: number) => {
    const col = Math.min(Math.floor(x / COL_PX), COLS - 1);
    let row = 0;
    while (row < sheet.rows.length - 1 && tops[row + 1] <= y) row += 1;
    return {
      nativeCol: col,
      nativeColOff: Math.round((x - col * COL_PX) * EMU_PER_PX),
      nativeRow: row,
      nativeRowOff: Math.round((y - tops[row]) * EMU_PER_PX),
    };
  };
  for (const img of sheet.images) {
    const src = img.kind === 'icon' ? ICON_URI : photo;
    if (!src) continue;
    const comma = src.indexOf(',');
    const imageId = wb.addImage({
      base64: src.slice(comma + 1),
      extension: src.slice(0, comma).includes('png') ? 'png' : 'jpeg',
    });
    ws.addImage(imageId, {
      tl: anchor(img.x, img.y) as unknown as ExcelJS.Anchor,
      ext: { width: img.width, height: img.height },
      editAs: 'oneCell',
    });
  }

  ws.pageSetup.printArea = `A1:${ws.getColumn(COLS).letter}${sheet.rows.length}`;
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString('base64');
}

/** Builds the CV as a styled .xlsx and returns the file (caller decides share/save). */
export async function exportCvExcel(): Promise<ReadyFile> {
  const { source, photo } = await loadCvData();
  const b64 = await renderCvXlsxBase64(buildCvSheet(source), photo);
  const path = `${FileSystem.cacheDirectory ?? ''}Seafarer-CV-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  return {
    uri: path,
    name: 'Seafarer-CV.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
