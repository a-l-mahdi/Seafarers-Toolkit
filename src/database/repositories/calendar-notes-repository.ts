import { openDatabase } from '../db';
import type { CalendarNote } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

function mapNote(row: Record<string, unknown>): CalendarNote {
  return {
    id: String(row.id),
    date: String(row.date),
    time: (row.time as string) ?? null,
    text: String(row.text ?? ''),
    remind: !!row.remind,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listCalendarNotes(): Promise<CalendarNote[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    "SELECT * FROM calendar_notes ORDER BY date, COALESCE(time, ''), created_at"
  );
  return rows.map(mapNote);
}

export async function saveCalendarNote(
  input: Pick<CalendarNote, 'date' | 'time' | 'text' | 'remind'> & { id?: string }
): Promise<CalendarNote> {
  const db = await openDatabase();
  const now = isoNow();
  const id = input.id ?? newId();
  // A reminder needs a time; without one the note is a plain note.
  const remind = input.remind && !!input.time;
  await db.runAsync(
    `INSERT INTO calendar_notes (id, date, time, text, remind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date, time = excluded.time, text = excluded.text,
       remind = excluded.remind, updated_at = excluded.updated_at`,
    id,
    input.date,
    input.time,
    input.text,
    remind ? 1 : 0,
    now,
    now
  );
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM calendar_notes WHERE id = ?', id);
  return mapNote(row!);
}

export async function deleteCalendarNote(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM calendar_notes WHERE id = ?', id);
}
