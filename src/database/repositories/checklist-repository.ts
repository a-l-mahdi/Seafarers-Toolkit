import { openDatabase } from '../db';
import type { ChecklistItem, TripChecklistMark } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

function mapItem(row: Record<string, unknown>): ChecklistItem {
  return {
    id: String(row.id),
    parentId: (row.parent_id as string) ?? null,
    preset: (row.preset as string) ?? null,
    name: (row.name as string) ?? null,
    quantity: Number(row.quantity ?? 1) || 1,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function listChecklistItems(): Promise<ChecklistItem[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM checklist_items ORDER BY sort_order, created_at',
  );
  return rows.map(mapItem);
}

export async function addChecklistItem(input: {
  parentId: string | null;
  name: string;
  quantity: number;
}): Promise<ChecklistItem> {
  const db = await openDatabase();
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM checklist_items WHERE parent_id IS ?',
    input.parentId,
  );
  const item: ChecklistItem = {
    id: newId(),
    parentId: input.parentId,
    preset: null,
    name: input.name,
    quantity: Math.max(1, Math.round(input.quantity)),
    sortOrder: (max?.m ?? -1) + 1,
  };
  await db.runAsync(
    'INSERT INTO checklist_items (id, parent_id, preset, name, quantity, sort_order, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?)',
    item.id,
    item.parentId,
    item.name,
    item.quantity,
    item.sortOrder,
    isoNow(),
  );
  return item;
}

export async function updateChecklistItem(id: string, input: { name: string | null; quantity: number }): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE checklist_items SET name = ?, quantity = ? WHERE id = ?',
    input.name,
    Math.max(1, Math.round(input.quantity)),
    id,
  );
}

/** Deletes an entry with its sub-items, and their ticks on every trip. */
export async function deleteChecklistItem(id: string): Promise<void> {
  const db = await openDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM trip_checklist WHERE item_key = ? OR item_key IN (SELECT id FROM checklist_items WHERE parent_id = ?)',
      id,
      id,
    );
    await db.runAsync('DELETE FROM checklist_items WHERE id = ?', id);
  });
}

/** Tick writes run one after another (rapid taps must not overlap), and reads wait for them. */
let marksQueue: Promise<unknown> = Promise.resolve();

export async function listTripChecklist(contractId: string): Promise<TripChecklistMark[]> {
  await marksQueue;
  const db = await openDatabase();
  const rows = await db.getAllAsync<{ item_key: string; packed_out: number; packed_back: number }>(
    'SELECT item_key, packed_out, packed_back FROM trip_checklist WHERE contract_id = ?',
    contractId,
  );
  return rows.map((r) => ({ itemKey: r.item_key, packedOut: !!r.packed_out, packedBack: !!r.packed_back }));
}

/** Sets one column (departure / return) for the given entries of a trip, in one statement. */
export function setTripChecklistMarks(
  contractId: string,
  itemKeys: string[],
  column: 'out' | 'back',
  packed: boolean,
): Promise<void> {
  if (itemKeys.length === 0) return Promise.resolve();
  const col = column === 'out' ? 'packed_out' : 'packed_back';
  const value = packed ? 1 : 0;
  const write = marksQueue.then(async () => {
    const db = await openDatabase();
    await db.runAsync(
      `INSERT INTO trip_checklist (contract_id, item_key, ${col}) VALUES ${itemKeys.map(() => '(?, ?, ?)').join(', ')}
       ON CONFLICT(contract_id, item_key) DO UPDATE SET ${col} = excluded.${col}`,
      itemKeys.flatMap((key) => [contractId, key, value]),
    );
  });
  marksQueue = write.catch(() => undefined);
  return write;
}

/** Drops the checklists of trips that have ended (signed off). */
export async function pruneFinishedTripChecklists(): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'DELETE FROM trip_checklist WHERE contract_id IN (SELECT id FROM contracts WHERE actual_sign_off IS NOT NULL)',
  );
}
