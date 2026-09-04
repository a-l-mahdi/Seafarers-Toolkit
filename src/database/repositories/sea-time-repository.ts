import { openDatabase } from '../db';
import {
  seaTimeForContract,
  sum,
} from '@/domain/sea-time';
import type {
  Contract,
  SeaTimeAmount,
  SeaTimeByRank,
  SeaTimeRecord,
  SeaTimeSource,
} from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

function mapRow(row: Record<string, unknown>): SeaTimeRecord {
  return {
    id: String(row.id),
    contractId: (row.contract_id as string) ?? null,
    rankId: (row.rank_id as string) ?? null,
    source: (row.source as SeaTimeSource) ?? 'manual',
    fromDate: (row.from_date as string) ?? null,
    toDate: (row.to_date as string) ?? null,
    days: Number(row.days ?? 0),
    hours: Number(row.hours ?? 0),
    verified: !!row.verified,
    notes: (row.notes as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listSeaTimeRecords(): Promise<SeaTimeRecord[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM sea_time_records ORDER BY created_at DESC'
  );
  return rows.map(mapRow);
}

export async function saveSeaTimeRecord(
  input: Omit<SeaTimeRecord, 'id' | 'createdAt'> & { id?: string }
): Promise<SeaTimeRecord> {
  const db = await openDatabase();
  const id = input.id ?? newId();
  await db.runAsync(
    `INSERT INTO sea_time_records (id, contract_id, rank_id, source, from_date, to_date, days, hours, verified, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       contract_id = excluded.contract_id, rank_id = excluded.rank_id, source = excluded.source,
       from_date = excluded.from_date, to_date = excluded.to_date, days = excluded.days,
       hours = excluded.hours, verified = excluded.verified, notes = excluded.notes`,
    id,
    input.contractId,
    input.rankId,
    input.source,
    input.fromDate,
    input.toDate,
    input.days,
    input.hours,
    input.verified ? 1 : 0,
    input.notes,
    isoNow()
  );
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM sea_time_records WHERE id = ?',
    id
  );
  return mapRow(row!);
}

export async function deleteSeaTimeRecord(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM sea_time_records WHERE id = ?', id);
}

/**
 * Total sea time = sum of all contract-derived sea time (computed live to avoid
 * double counting) + all manual/imported records.
 */
export async function getSeaTimeSummary(
  contracts: Contract[],
  rankNames: Map<string, string>
): Promise<{ total: SeaTimeAmount; byRank: SeaTimeByRank[] }> {
  const records = await listSeaTimeRecords();
  const manualRecords = records.filter((r) => r.contractId === null);

  const buckets = new Map<string | null, SeaTimeAmount>();

  const push = (rankId: string | null, amount: SeaTimeAmount) => {
    const key = rankId ?? '_none';
    buckets.set(key, sum([buckets.get(key) ?? { days: 0, hours: 0 }, amount]));
  };

  for (const contract of contracts) {
    push(contract.rankId || null, seaTimeForContract(contract));
  }
  for (const record of manualRecords) {
    push(record.rankId, { days: record.days, hours: record.hours });
  }

  const byRank: SeaTimeByRank[] = [...buckets.entries()]
    .map(([key, amount]) => {
      const rankId = key === '_none' ? null : key;
      const rankName = rankId ? (rankNames.get(rankId) ?? rankId) : 'Unranked';
      return { rankId, rankName, days: amount.days, hours: amount.hours };
    })
    .sort((a, b) => b.days - a.days);

  return { total: sum([...buckets.values()]), byRank };
}
