import { openDatabase } from '../db';
import type { Profile } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

const SINGLETON_ID = 'me';

function mapRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    dateOfBirth: (row.date_of_birth as string) ?? null,
    nationality: (row.nationality as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    seamanBookNumber: (row.seaman_book_number as string) ?? null,
    passportNumber: (row.passport_number as string) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    country: (row.country as string) ?? null,
    zipCode: (row.zip_code as string) ?? null,
    landline: (row.landline as string) ?? null,
    department: (row.department as Profile['department']) ?? null,
    currentRankId: (row.current_rank_id as string) ?? null,
    nextRankId: (row.next_rank_id as string) ?? null,
    photoPath: (row.photo_path as string) ?? null,
    updatedAt: String(row.updated_at ?? ''),
  };
}

export async function getProfile(): Promise<Profile | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM profile WHERE id = ?', SINGLETON_ID);
  return row ? mapRow(row) : null;
}

export async function saveProfile(input: Omit<Profile, 'id' | 'updatedAt'>): Promise<Profile> {
  const db = await openDatabase();
  const existing = await getProfile();
  const profile: Profile = {
    ...input,
    id: existing?.id ?? SINGLETON_ID,
    updatedAt: isoNow(),
  };
  await db.runAsync(
    `INSERT INTO profile (id, first_name, last_name, date_of_birth, nationality, email, phone,
       seaman_book_number, passport_number, address, city, state, country, zip_code, landline,
       department, current_rank_id, next_rank_id, photo_path, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       first_name = excluded.first_name, last_name = excluded.last_name,
       date_of_birth = excluded.date_of_birth, nationality = excluded.nationality,
       email = excluded.email, phone = excluded.phone,
       seaman_book_number = excluded.seaman_book_number, passport_number = excluded.passport_number,
       address = excluded.address, city = excluded.city, state = excluded.state,
       country = excluded.country, zip_code = excluded.zip_code, landline = excluded.landline,
       department = excluded.department, current_rank_id = excluded.current_rank_id,
       next_rank_id = excluded.next_rank_id, photo_path = excluded.photo_path,
       updated_at = excluded.updated_at`,
    profile.id,
    profile.firstName,
    profile.lastName,
    profile.dateOfBirth,
    profile.nationality,
    profile.email,
    profile.phone,
    profile.seamanBookNumber,
    profile.passportNumber,
    profile.address,
    profile.city,
    profile.state,
    profile.country,
    profile.zipCode,
    profile.landline,
    profile.department,
    profile.currentRankId,
    profile.nextRankId,
    profile.photoPath,
    profile.updatedAt
  );
  return profile;
}

export async function ensureProfileId(): Promise<string> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO profile (id, first_name, last_name, updated_at) VALUES (?, ?, ?, ?)',
    SINGLETON_ID,
    '',
    '',
    isoNow()
  );
  return SINGLETON_ID;
}

export const PROFILE_ID = SINGLETON_ID;
export const tempId = newId;
