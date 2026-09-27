import type { CalendarNote, Contract, LeaveSettings } from '@/types/domain';
import { computeLeaveLedger } from './leave';
import { diffInDays, todayISO } from '@/utils/date';

export type CalendarEventKind = 'trip_start' | 'trip_end' | 'leave_start' | 'leave_end' | 'doc_expiry' | 'note';

export interface CalendarEvent {
  key: string;
  kind: CalendarEventKind;
  /** ISO day. */
  date: string;
  /** HH:MM for notes with a time. */
  time: string | null;
  /** Vessel, document or note text. */
  label: string;
  /** Contract / document / note id the event opens. */
  refId: string;
  /** Note with a reminder. */
  remind: boolean;
}

/** Same-day order: a trip ends and leave begins before a new one starts. */
const KIND_ORDER: Record<CalendarEventKind, number> = {
  trip_end: 0,
  leave_start: 1,
  leave_end: 2,
  trip_start: 3,
  doc_expiry: 4,
  note: 5,
};

/**
 * The calendar's events (single days only, no ranges): trip start / end, leave
 * start / end, document expiry and the user's notes — oldest first.
 * Leave follows the leave ledger (carry-over, cut short by the next join) and
 * exists only for trips that have started.
 */
export function buildCalendarEvents(input: {
  contracts: (Contract & { vesselName?: string | null })[];
  documents: { id: string; name: string; expiryDate: string | null }[];
  notes: CalendarNote[];
  leaveSettings: LeaveSettings | null;
  now?: Date;
}): CalendarEvent[] {
  const { contracts, documents, notes, leaveSettings, now = new Date() } = input;
  const events: CalendarEvent[] = [];
  const push = (e: Omit<CalendarEvent, 'key' | 'time' | 'remind'> & Partial<Pick<CalendarEvent, 'time' | 'remind'>>) =>
    events.push({ time: null, remind: false, ...e, key: `${e.kind}:${e.refId}:${e.date}` });

  for (const c of contracts) {
    const label = c.vesselName ?? '—';
    push({ kind: 'trip_start', date: c.joinDate, label, refId: c.id });
    push({ kind: 'trip_end', date: c.actualSignOff ?? c.expectedSignOff, label, refId: c.id });
  }

  if (leaveSettings) {
    const ledger = computeLeaveLedger(contracts, leaveSettings, now);
    const byId = new Map(contracts.map((c) => [c.id, c]));
    for (const entry of ledger.entries) {
      const c = byId.get(entry.contractId);
      if (!c || entry.windowDays <= 0) continue;
      const start = c.actualSignOff ?? c.expectedSignOff;
      if (entry.leaveUntil <= start) continue;
      const label = c.vesselName ?? '—';
      push({ kind: 'leave_start', date: start, label, refId: c.id });
      push({ kind: 'leave_end', date: entry.leaveUntil, label, refId: c.id });
    }
  }

  for (const d of documents) {
    if (d.expiryDate) push({ kind: 'doc_expiry', date: d.expiryDate, label: d.name, refId: d.id });
  }

  for (const n of notes) {
    push({ kind: 'note', date: n.date, time: n.time, label: n.text, refId: n.id, remind: n.remind && !!n.time });
  }

  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === 'note' && b.kind === 'note' ? (a.time ?? '').localeCompare(b.time ?? '') : 0) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  );
}

/** Index of the first event today or later (the last event if all are past; -1 if none). */
export function upcomingEventIndex(events: CalendarEvent[], now: Date = new Date()): number {
  if (events.length === 0) return -1;
  const today = todayISO(now);
  const i = events.findIndex((e) => e.date >= today);
  return i === -1 ? events.length - 1 : i;
}

/** Whole days from today to the event (negative when past). */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  return diffInDays(todayISO(now), iso);
}

/**
 * Notes to show under the calendar (at most `limit`): the selected day's notes,
 * otherwise the coming ones, topped up with the most recent past ones.
 */
export function notesToShow(
  notes: CalendarNote[],
  selectedISO: string | null,
  limit = 3,
  now: Date = new Date()
): CalendarNote[] {
  const sorted = [...notes].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')
  );
  if (selectedISO) {
    const day = sorted.filter((n) => n.date === selectedISO);
    if (day.length > 0) return day.slice(0, limit);
  }
  const today = todayISO(now);
  const coming = sorted.filter((n) => n.date >= today);
  const past = sorted.filter((n) => n.date < today).reverse();
  return [...coming, ...past].slice(0, limit);
}

/** Note reminders still ahead (soonest first) — for the home screen alerts. */
export function upcomingReminders(notes: CalendarNote[], now: Date = new Date()): CalendarNote[] {
  return notes
    .filter((n) => n.remind && n.time && new Date(`${n.date}T${n.time}:00`).getTime() > now.getTime())
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
