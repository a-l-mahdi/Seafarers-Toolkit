import { openDatabase } from '../db';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

export type TripFileKind = 'contract' | 'final_wages' | 'sea_service_report' | 'other';

export interface TripFile {
  id: string;
  contractId: string | null;
  seaTimeId: string | null;
  kind: TripFileKind;
  localPath: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): TripFile {
  return {
    id: String(row.id),
    contractId: (row.contract_id as string) ?? null,
    seaTimeId: (row.sea_time_id as string) ?? null,
    kind: (row.kind as TripFileKind) ?? 'contract',
    localPath: String(row.local_path),
    fileName: String(row.file_name),
    mimeType: (row.mime_type as string) ?? null,
    size: (row.size as number) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listTripFiles(filter: { contractId?: string; seaTimeId?: string; kind?: TripFileKind }): Promise<TripFile[]> {
  const db = await openDatabase();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.contractId) {
    where.push('contract_id = ?');
    params.push(filter.contractId);
  }
  if (filter.seaTimeId) {
    where.push('sea_time_id = ?');
    params.push(filter.seaTimeId);
  }
  if (filter.kind) {
    where.push('kind = ?');
    params.push(filter.kind);
  }
  const sql = `SELECT * FROM trip_files ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  const rows = await db.getAllAsync<Record<string, unknown>>(sql, ...params);
  return rows.map(mapRow);
}

export async function saveTripFile(file: Omit<TripFile, 'id' | 'createdAt'>): Promise<TripFile> {
  const db = await openDatabase();
  const rec: TripFile = { ...file, id: newId(), createdAt: isoNow() };
  await db.runAsync(
    `INSERT INTO trip_files (id, contract_id, sea_time_id, kind, local_path, file_name, mime_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rec.id,
    rec.contractId,
    rec.seaTimeId,
    rec.kind,
    rec.localPath,
    rec.fileName,
    rec.mimeType,
    rec.size,
    rec.createdAt
  );
  return rec;
}

export async function deleteTripFile(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM trip_files WHERE id = ?', id);
}
