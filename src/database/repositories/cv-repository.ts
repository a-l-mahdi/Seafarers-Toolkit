import { openDatabase } from '../db';
import { normalizeCvProfile } from '@/domain/cv';
import type { CvProfile } from '@/types/domain';

const CV_KEY = 'cv_profile';

/** Loads the stored CV profile, merged over defaults (never throws on bad data). */
export async function getCvProfile(): Promise<CvProfile> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    CV_KEY
  );
  if (!row) return normalizeCvProfile(null);
  try {
    return normalizeCvProfile(JSON.parse(row.value) as Partial<CvProfile>);
  } catch {
    return normalizeCvProfile(null);
  }
}

export async function saveCvProfile(profile: CvProfile): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    CV_KEY,
    JSON.stringify(profile)
  );
}
