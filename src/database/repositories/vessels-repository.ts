import { openDatabase } from '../db';
import * as FileSystem from 'expo-file-system/legacy';
import type { Contract, Vessel } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

function mapVessel(row: Record<string, unknown>): Vessel {
  return {
    id: String(row.id),
    name: String(row.name),
    imo: (row.imo as string) ?? null,
    type: (row.type as string) ?? null,
    flag: (row.flag as string) ?? null,
    grossTonnage: (row.gross_tonnage as number) ?? null,
    netTonnage: (row.net_tonnage as number) ?? null,
    owner: (row.owner as string) ?? null,
    managementCompany: (row.management_company as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listVessels(search?: string): Promise<Vessel[]> {
  const db = await openDatabase();
  if (search) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM vessels WHERE name LIKE ? OR imo LIKE ? ORDER BY name',
      `%${search}%`,
      `%${search}%`
    );
    return rows.map(mapVessel);
  }
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM vessels ORDER BY name');
  return rows.map(mapVessel);
}

export async function getVessel(id: string): Promise<Vessel | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM vessels WHERE id = ?', id);
  return row ? mapVessel(row) : null;
}

export async function saveVessel(
  input: Omit<Vessel, 'id' | 'createdAt'> & { id?: string }
): Promise<Vessel> {
  const db = await openDatabase();
  const id = input.id ?? newId();
  const createdAt = input.id ? (await getVessel(id))?.createdAt ?? isoNow() : isoNow();
  const vessel: Vessel = { ...input, id, createdAt };
  await db.runAsync(
    `INSERT INTO vessels (id, name, imo, type, flag, gross_tonnage, net_tonnage, owner, management_company, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, imo = excluded.imo, type = excluded.type, flag = excluded.flag,
       gross_tonnage = excluded.gross_tonnage, net_tonnage = excluded.net_tonnage,
       owner = excluded.owner, management_company = excluded.management_company, notes = excluded.notes`,
    vessel.id,
    vessel.name,
    vessel.imo,
    vessel.type,
    vessel.flag,
    vessel.grossTonnage,
    vessel.netTonnage,
    vessel.owner,
    vessel.managementCompany,
    vessel.notes,
    vessel.createdAt
  );
  return vessel;
}

export async function deleteVessel(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM vessels WHERE id = ?', id);
}

function mapContract(row: Record<string, unknown>): Contract {
  return {
    id: String(row.id),
    vesselId: String(row.vessel_id ?? ''),
    rankId: (row.rank_id as string) ?? '',
    joinDate: String(row.join_date),
    expectedSignOff: String(row.expected_sign_off),
    actualSignOff: (row.actual_sign_off as string) ?? null,
    durationDays: (row.duration_days as number) ?? null,
    durationJson: (row.duration_json as string) ?? null,
    status: (row.status as Contract['status']) ?? 'planned',
    notes: (row.notes as string) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export interface ContractListRow extends Contract {
  vesselName: string | null;
  rankName: string | null;
}

export async function listContracts(): Promise<ContractListRow[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT c.*, v.name AS vessel_name, r.name AS rank_name
     FROM contracts c
     LEFT JOIN vessels v ON v.id = c.vessel_id
     LEFT JOIN ranks r ON r.id = c.rank_id
     ORDER BY c.join_date DESC, c.created_at DESC`
  );
  return rows.map((row) => ({
    ...mapContract(row),
    vesselName: (row.vessel_name as string) ?? null,
    rankName: (row.rank_name as string) ?? null,
  }));
}

export async function getActiveContract(): Promise<Contract | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM contracts WHERE actual_sign_off IS NULL AND join_date <= date('now','localtime')
     ORDER BY join_date DESC LIMIT 1`
  );
  return row ? mapContract(row) : null;
}

export async function saveContract(
  input: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Contract> {
  const db = await openDatabase();
  // A sailor cannot be on two vessels at once: reject overlapping contracts.
  // (Join dates before the previous leave window are fine — leave carries over.)
  const overlap = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM contracts
     WHERE id IS NOT ?
       AND join_date <= (CASE WHEN ? IS NOT NULL THEN ? ELSE ? END)
       AND (CASE WHEN actual_sign_off IS NOT NULL THEN actual_sign_off ELSE expected_sign_off END) >= ?`,
    input.id ?? '',
    input.actualSignOff,
    input.actualSignOff,
    input.expectedSignOff,
    input.joinDate
  );
  if (overlap) throw new Error('CONTRACT_OVERLAP');
  const now = isoNow();
  const id = input.id ?? newId();
  const existing = input.id
    ? await db.getFirstAsync<{ created_at: string }>('SELECT created_at FROM contracts WHERE id = ?', id)
    : null;
  await db.runAsync(
    `INSERT INTO contracts (id, vessel_id, rank_id, join_date, expected_sign_off, actual_sign_off,
       duration_days, duration_json, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       vessel_id = excluded.vessel_id, rank_id = excluded.rank_id, join_date = excluded.join_date,
       expected_sign_off = excluded.expected_sign_off, actual_sign_off = excluded.actual_sign_off,
       duration_days = excluded.duration_days, duration_json = excluded.duration_json,
       status = excluded.status, notes = excluded.notes,
       updated_at = excluded.updated_at`,
    id,
    input.vesselId,
    input.rankId || null,
    input.joinDate,
    input.expectedSignOff,
    input.actualSignOff,
    input.durationDays,
    input.durationJson ?? null,
    input.status,
    input.notes,
    existing?.created_at ?? now,
    now
  );
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM contracts WHERE id = ?', id);
  return mapContract(row!);
}

export async function signOffContract(id: string, actualSignOff: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    "UPDATE contracts SET actual_sign_off = ?, status = 'completed', updated_at = ? WHERE id = ?",
    actualSignOff,
    isoNow(),
    id
  );
}

export async function deleteContract(id: string): Promise<void> {
  const db = await openDatabase();
  // sea_time_records and trip_files cascade via foreign keys; delete explicitly
  // for clarity, then clean up the contract's attachments on disk (best-effort).
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM trip_files WHERE contract_id = ?', id);
    await db.runAsync('DELETE FROM contracts WHERE id = ?', id);
  });
  try {
    const dir = `${FileSystem.documentDirectory ?? ''}trips/${id}`;
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    // disk cleanup is best-effort
  }
}

export async function validateIMO(imo: string): Promise<boolean> {
  if (!/^\d{7}$/.test(imo)) return false;
  const digits = imo.split('').map(Number);
  const weights = [7, 6, 5, 4, 3, 2];
  const sum = digits.slice(0, 6).reduce((acc, d, i) => acc + d * weights[i], 0);
  return (sum % 10) === digits[6];
}
