import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { getProfile } from '@/database/repositories/profile-repository';
import { getCvProfile } from '@/database/repositories/cv-repository';
import { listDocuments } from '@/database/repositories/documents-repository';
import { listContracts, listVessels } from '@/database/repositories/vessels-repository';
import { listRanks } from '@/database/repositories/ranks-repository';
import { diffInDays } from '@/utils/date';
import type { CvProfile, Profile, Vessel } from '@/types/domain';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO (yyyy-mm-dd) → "17 Sep 2025". Blank for missing/invalid. */
function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const mon = MONTHS[Number(mo) - 1] ?? mo;
  return `${Number(d)} ${mon} ${y}`;
}

function esc(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Human "Xy Ym" from a day count. */
function durationLabel(days: number): string {
  if (days <= 0) return '';
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30.44);
  const parts: string[] = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}m`);
  return parts.join(' ') || `${days}d`;
}

async function photoDataUri(profile: Profile | null): Promise<string | null> {
  if (!profile?.photoPath) return null;
  try {
    const info = await FileSystem.getInfoAsync(profile.photoPath);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(profile.photoPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = profile.photoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${b64}`;
  } catch {
    return null;
  }
}

function row(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

function fieldRows(pairs: [string, string][]): string {
  return pairs
    .filter(([, v]) => v && v.trim() !== '')
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('');
}

function section(title: string, inner: string): string {
  if (!inner || inner.trim() === '') return '';
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

/** Builds the full CV as an HTML document (English, print/A4 friendly). */
export function buildCvHtml(data: {
  profile: Profile | null;
  cv: CvProfile;
  documents: { name: string; typeName: string | null; number: string | null; issueDate: string | null; expiryDate: string | null; issuingAuthority: string | null; issuingCountry: string | null; placeOfIssue: string | null }[];
  contracts: { rankName: string | null; vesselName: string | null; joinDate: string; expectedSignOff: string; actualSignOff: string | null; durationDays: number | null }[];
  vesselsByName: Map<string, Vessel>;
  currentRankName: string | null;
  photo: string | null;
}): string {
  const { profile, cv, documents, contracts, vesselsByName, currentRankName, photo } = data;
  const fullName = [profile?.firstName, cv.middleName, profile?.lastName].filter(Boolean).join(' ').trim() || 'Seafarer';

  const genderMap: Record<string, string> = { male: 'Male', female: 'Female' };
  const maritalMap: Record<string, string> = { single: 'Single', married: 'Married', other: 'Other' };

  const personal = fieldRows([
    ['Position applied for', cv.positionAppliedFor],
    ['Present rank', currentRankName ?? ''],
    ['Available from', fmt(cv.dateOfAvailability)],
    ['Date of birth', fmt(profile?.dateOfBirth)],
    ['Place of birth', cv.placeOfBirth],
    ['Nationality', profile?.nationality ?? ''],
    ['Gender', genderMap[cv.gender] ?? ''],
    ['Marital status', maritalMap[cv.maritalStatus] ?? ''],
    ['Children', cv.children],
    ['Height', cv.heightCm ? `${cv.heightCm} cm` : ''],
    ['Weight', cv.weightKg ? `${cv.weightKg} kg` : ''],
    ['Blood group', cv.bloodGroup],
    ['Languages', cv.languages],
    ['Nearest airport', cv.nearestAirport],
  ]);

  const contact = fieldRows([
    ['Email', profile?.email ?? ''],
    ['Mobile', profile?.phone ?? ''],
    ['Landline', profile?.landline ?? ''],
    [
      'Address',
      [profile?.address, profile?.city, profile?.state, profile?.zipCode, profile?.country]
        .filter(Boolean)
        .join(', '),
    ],
  ]);

  const ids = fieldRows([
    ['Passport no.', profile?.passportNumber ?? ''],
    ["Seaman's book (CDC) no.", profile?.seamanBookNumber ?? ''],
    ['National seafarer ID', cv.nationalSeafarerId],
    ['SID no.', cv.sidNumber],
    ['Union membership', cv.unionMembership],
  ]);

  const certRows = documents
    .map((d) =>
      row([
        esc(d.name || d.typeName || ''),
        esc(d.number ?? ''),
        esc(fmt(d.issueDate)),
        d.expiryDate ? esc(fmt(d.expiryDate)) : 'Unlimited',
        esc([d.placeOfIssue, d.issuingAuthority, d.issuingCountry].filter(Boolean).join(', ')),
      ])
    )
    .join('');
  const certificates = certRows
    ? `<table class="grid"><thead><tr><th>Certificate</th><th>Number</th><th>Issued</th><th>Expiry</th><th>Place of issue</th></tr></thead><tbody>${certRows}</tbody></table>`
    : '';

  let totalSeaDays = 0;
  const seaRows = contracts
    .map((c) => {
      const end = c.actualSignOff ?? c.expectedSignOff;
      const days = c.durationDays ?? Math.max(diffInDays(c.joinDate, end), 0);
      totalSeaDays += days;
      const v = c.vesselName ? vesselsByName.get(c.vesselName) : undefined;
      const vesselType = v?.type ?? '';
      const gt = v?.grossTonnage ? `${v.grossTonnage} GT` : '';
      const company = v?.managementCompany ?? v?.owner ?? '';
      return row([
        esc(c.rankName ?? ''),
        esc(c.vesselName ?? ''),
        esc([vesselType, gt].filter(Boolean).join(' · ')),
        esc(fmt(c.joinDate)),
        esc(fmt(end)),
        esc(durationLabel(days)),
        esc(company),
      ]);
    })
    .join('');
  const seaService = seaRows
    ? `<table class="grid"><thead><tr><th>Rank</th><th>Vessel</th><th>Type</th><th>Sign on</th><th>Sign off</th><th>Duration</th><th>Company</th></tr></thead><tbody>${seaRows}</tbody></table>
       <p class="muted">Total sea service: <strong>${esc(durationLabel(totalSeaDays))}</strong></p>`
    : '';

  const eduRows = cv.education
    .map((e) =>
      row([
        esc(e.institution),
        esc([fmt(e.from), fmt(e.to)].filter(Boolean).join(' – ')),
        esc(e.qualification),
        esc(e.location ?? ''),
      ])
    )
    .join('');
  const education = eduRows
    ? `<table class="grid"><thead><tr><th>Institution</th><th>Period</th><th>Qualification</th><th>Location</th></tr></thead><tbody>${eduRows}</tbody></table>`
    : '';

  const nok = fieldRows([
    ['Name', cv.nokName],
    ['Relationship', cv.nokRelationship],
    ['Phone', cv.nokPhone],
    ['Address', cv.nokAddress],
  ]);

  const bank = fieldRows([
    ['Bank name', cv.bankName],
    ['Account holder', cv.bankAccountHolder],
    ['Account no.', cv.bankAccountNumber],
    ['Branch code', cv.bankBranchCode],
    ['SWIFT', cv.bankSwift],
    ['IBAN', cv.bankIban],
    ['Bank address', cv.bankAddress],
  ]);

  const healthItems: [string, boolean][] = [
    ['Involved in any marine accident / investigation', cv.healthMarineAccident],
    ['Suffered any accident causing temporary/partial disability', cv.healthDisability],
    ['Currently under medical treatment / medication', cv.healthMedication],
    ['Suffer from any disease affecting fitness for sea service', cv.healthDisease],
    ['Underwent psychiatric treatment', cv.healthPsychiatric],
    ['Addicted to alcohol or drugs', cv.healthAddiction],
  ];
  const healthRows = healthItems
    .map(([q, yes]) => `<tr><td>${esc(q)}</td><td class="yn">${yes ? 'Yes' : 'No'}</td></tr>`)
    .join('');
  const health = `<table class="grid"><tbody>${healthRows}</tbody></table>${
    cv.healthDetails ? `<p class="muted">${esc(cv.healthDetails)}</p>` : ''
  }`;

  const photoBox = photo
    ? `<img class="photo" src="${photo}" alt="photo" />`
    : `<div class="photo placeholder">PHOTO</div>`;

  const addressedTo = cv.addressedTo
    ? `<p class="addressed">To: <strong>${esc(cv.addressedTo)}</strong></p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  /* Table-based layout so it renders identically in the PDF AND when opened as
     an .xls in Excel/WPS (their HTML engines don't support flexbox). */
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14232f; font-size: 11px; margin: 0; padding: 24px 26px; }
  table.header { width: 100%; border-bottom: 3px solid #0E5AA7; padding-bottom: 12px; margin-bottom: 6px; }
  td.photo-cell { width: 112px; vertical-align: top; padding-right: 16px; }
  .photo { width: 96px; height: 120px; object-fit: cover; border: 1px solid #c7d2dc; border-radius: 4px; }
  .photo.placeholder { text-align: center; line-height: 120px; color: #9aa8b5; font-size: 10px; background: #f2f5f8; }
  td.head-main { vertical-align: top; }
  h1 { font-size: 22px; margin: 0 0 2px; color: #0E5AA7; }
  .subtitle { font-size: 13px; color: #33475b; margin: 0 0 6px; font-weight: bold; }
  .addressed { margin: 4px 0 0; color: #33475b; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #0E5AA7; border-bottom: 1px solid #d7e0e8; padding-bottom: 3px; margin: 16px 0 8px; }
  section { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  table.fields th { text-align: left; width: 42%; color: #5b6b7a; font-weight: normal; padding: 2px 8px 2px 0; vertical-align: top; }
  table.fields td { padding: 2px 0; vertical-align: top; }
  table.two-col > tbody > tr > td { width: 50%; vertical-align: top; padding-right: 18px; }
  table.grid th, table.grid td { border: 1px solid #d7e0e8; padding: 4px 6px; text-align: left; }
  table.grid th { background: #eef3f8; color: #33475b; font-size: 10px; }
  .yn { text-align: center; width: 60px; font-weight: bold; }
  .muted { color: #5b6b7a; margin: 6px 0 0; }
  table.sign { margin-top: 28px; }
  table.sign td { border-top: 1px solid #33475b; padding-top: 4px; width: 200px; text-align: center; color: #33475b; }
  table.sign td.gap { border: none; }
</style></head>
<body>
  <table class="header"><tr>
    <td class="photo-cell">${photoBox}</td>
    <td class="head-main">
      <h1>${esc(fullName)}</h1>
      <p class="subtitle">${esc(cv.positionAppliedFor || currentRankName || 'Seafarer')}</p>
      <table class="fields">${contact}</table>
      ${addressedTo}
    </td>
  </tr></table>

  ${section('Personal details', `<table class="two-col"><tr><td><table class="fields">${personal}</table></td><td><table class="fields">${ids}</table></td></tr></table>`)}
  ${section('Certificates & documents', certificates)}
  ${section('Sea service', seaService)}
  ${section('Education & training', education)}
  ${section('Next of kin', `<table class="fields">${nok}</table>`)}
  ${section('Bank details', `<table class="fields">${bank}</table>`)}
  ${section('Health declaration', health)}

  <table class="sign"><tr>
    <td>Date</td>
    <td class="gap"></td>
    <td>Signature</td>
  </tr></table>
</body></html>`;
}

type CvData = Parameters<typeof buildCvHtml>[0];

/** Loads and prepares everything the CV needs (documents filtered by the user's
 *  include/exclude choices). */
async function loadCvData(): Promise<CvData> {
  const [profile, cv, allDocuments, contracts, vessels, ranks] = await Promise.all([
    getProfile(),
    getCvProfile(),
    listDocuments(),
    listContracts(),
    listVessels(),
    listRanks(),
  ]);
  const excluded = new Set(cv.excludedDocumentIds ?? []);
  const documents = allDocuments.filter((d) => !excluded.has(d.id));
  const vesselsByName = new Map<string, Vessel>();
  for (const v of vessels) vesselsByName.set(v.name, v);
  const currentRankName = ranks.find((r) => r.id === profile?.currentRankId)?.name ?? null;
  const photo = await photoDataUri(profile);
  return { profile, cv, documents, contracts, vesselsByName, currentRankName, photo };
}

/** Renders the CV to a PDF and opens the share sheet. */
export async function exportCv(): Promise<void> {
  const data = await loadCvData();
  const { uri } = await Print.printToFileAsync({ html: buildCvHtml(data) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Seafarer CV',
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Exports the CV as an Excel-openable .xls. It writes the SAME HTML as the PDF
 * (photo, every section, tables and spacing) so the spreadsheet matches the PDF;
 * Excel/WPS open an HTML workbook natively, so no library is needed.
 */
export async function exportCvExcel(): Promise<void> {
  const data = await loadCvData();
  const html = buildCvHtml(data);
  const path = `${FileSystem.cacheDirectory ?? ''}seafarer-cv-${Date.now()}.xls`;
  await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/vnd.ms-excel',
      dialogTitle: 'Seafarer CV',
      UTI: 'com.microsoft.excel.xls',
    });
  }
}

