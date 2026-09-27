import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import fa from 'i18n-iso-countries/langs/fa.json';

countries.registerLocale(en);
countries.registerLocale(fa);

export interface Country {
  /** ISO 3166-1 alpha-2 code — what the app stores. */
  code: string;
  en: string;
  fa: string;
}

/** ISO codes left out of the app's country list. */
const EXCLUDED = new Set(['IL']);

/** Every listed ISO country, with its short (common) English and Persian names. */
export const COUNTRIES: Country[] = Object.keys(countries.getAlpha2Codes())
  .filter((code) => !EXCLUDED.has(code))
  .map((code) => ({
    code,
    en: countries.getName(code, 'en', { select: 'alias' }) ?? code,
    fa: countries.getName(code, 'fa', { select: 'alias' }) ?? code,
  }));

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | null | undefined): Country | null {
  return code ? (BY_CODE.get(code.toUpperCase()) ?? null) : null;
}

/** Arabic letter forms and spacing variants folded, so searches match either way. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[ً-ٰٟ‌‏‎]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countryName(country: Country, locale: string): string {
  return locale === 'fa' ? country.fa : country.en;
}

const SORTED = new Map<string, Country[]>();

/** All countries in alphabetical order of their name in the given language (computed once). */
export function sortedCountries(locale: string): Country[] {
  const lang = locale === 'fa' ? 'fa' : 'en';
  let list = SORTED.get(lang);
  if (!list) {
    // One collator for the whole sort — localeCompare(…, lang) builds one per call.
    const collator = new Intl.Collator(lang);
    list = [...COUNTRIES].sort((a, b) => collator.compare(a[lang], b[lang]));
    SORTED.set(lang, list);
  }
  return list;
}

/** Normalized names per country, built once, so each keystroke only compares strings. */
const SEARCH_KEYS = new Map(
  COUNTRIES.map((c) => [
    c.code,
    `${normalize(c.fa)}
${normalize(c.en)}`,
  ]),
);

export function matchesCountry(country: Country, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return (SEARCH_KEYS.get(country.code) ?? '').includes(q) || country.code.toLowerCase() === q;
}

/**
 * The country a stored value stands for: an ISO code (current format) or a
 * name typed in by hand before the list existed, in English or Persian.
 */
export function resolveCountry(value: string | null | undefined): Country | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const byCode = /^[a-z]{2}$/i.test(text) ? countryByCode(text) : null;
  if (byCode) return byCode;
  const code = countries.getAlpha2Code(text, 'en') ?? countries.getAlpha2Code(text, 'fa');
  if (code) return countryByCode(code);
  const q = normalize(text);
  return COUNTRIES.find((c) => normalize(c.fa) === q || normalize(c.en) === q) ?? null;
}

/** How a stored flag / nationality reads: the localized name, or the old free text. */
export function countryLabel(value: string | null | undefined, locale: string): string | null {
  const country = resolveCountry(value);
  if (country) return countryName(country, locale);
  return value?.trim() || null;
}
