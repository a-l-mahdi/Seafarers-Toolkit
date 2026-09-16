import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fa from './fa';

export const LOCALES = ['en', 'fa'] as const;
export type Locale = (typeof LOCALES)[number];

export const isRTL = (locale: Locale) => locale === 'fa';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: 'fa',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function changeLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
}

export function formatDate(iso: string, locale: Locale, useJalali: boolean): string {
  if (useJalali && locale === 'fa') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { format } = require('date-fns-jalali') as typeof import('date-fns-jalali');
    const [y, m, d] = iso.split('-').map(Number);
    return format(new Date(Date.UTC(y, m - 1, d)), 'yyyy/MM/dd');
  }
  return iso;
}

export default i18n;
