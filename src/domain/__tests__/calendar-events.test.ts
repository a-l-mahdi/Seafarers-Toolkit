import { buildCalendarEvents, notesToShow, upcomingEventIndex, upcomingReminders } from '../calendar-events';
import type { CalendarNote, Contract, LeaveSettings } from '@/types/domain';

const contract = (id: string, join: string, end: string, actual: string | null, vesselName: string) =>
  ({
    id,
    vesselId: 'v',
    rankId: 'r',
    joinDate: join,
    expectedSignOff: end,
    actualSignOff: actual,
    durationDays: null,
    monthlyWage: null,
    wageCurrency: null,
    travelDays: null,
    bonus: null,
    status: actual ? 'completed' : 'active',
    notes: null,
    createdAt: '',
    updatedAt: '',
    vesselName,
  }) as Contract & { vesselName: string };

const note = (id: string, date: string, time: string | null, remind: boolean): CalendarNote => ({
  id,
  date,
  time,
  text: id,
  remind,
  createdAt: '',
  updatedAt: '',
});

const settings: LeaveSettings = { mode: 'ratio', onboardDays: 30, leaveDays: 15, manualLeaveStartDate: null, manualLeaveEndDate: null };
const now = new Date('2026-09-26T10:00:00');

describe('calendar events', () => {
  const events = buildCalendarEvents({
    contracts: [
      contract('a', '2026-01-01', '2026-05-01', '2026-05-01', 'Alpha'),
      contract('b', '2026-11-01', '2027-03-01', null, 'Beta'),
    ],
    documents: [
      { id: 'p', name: 'Passport', expiryDate: '2026-10-10' },
      { id: 'x', name: 'No expiry', expiryDate: null },
    ],
    notes: [note('n1', '2026-10-01', '08:30', true), note('n2', '2026-10-01', null, false)],
    leaveSettings: settings,
    now,
  });

  it('lists single-day events oldest first with leave from the ledger', () => {
    expect(events.map((e) => `${e.date} ${e.kind}`)).toEqual([
      '2026-01-01 trip_start',
      '2026-05-01 trip_end',
      '2026-05-01 leave_start',
      // 120 days onboard → 60 days leave.
      '2026-06-30 leave_end',
      '2026-10-01 note',
      '2026-10-01 note',
      '2026-10-10 doc_expiry',
      '2026-11-01 trip_start',
      '2027-03-01 trip_end',
    ]);
  });

  it('gives no leave to a trip that has not started', () => {
    expect(events.filter((e) => e.refId === 'b').map((e) => e.kind)).toEqual(['trip_start', 'trip_end']);
  });

  it('starts the navigator at the next event from today', () => {
    expect(events[upcomingEventIndex(events, now)].date).toBe('2026-10-01');
    expect(upcomingEventIndex(events, new Date('2030-01-01T00:00:00'))).toBe(events.length - 1);
    expect(upcomingEventIndex([], now)).toBe(-1);
  });

  it('only notes with a time carry a reminder', () => {
    const notes = events.filter((e) => e.kind === 'note');
    expect(notes.map((e) => [e.refId, e.remind])).toEqual([
      ['n2', false],
      ['n1', true],
    ]);
  });
});

describe('notes panel and reminders', () => {
  const notes = [
    note('old', '2026-09-01', null, false),
    note('soon', '2026-09-26', '09:00', true),
    note('later', '2026-09-26', '18:00', true),
    note('next', '2026-12-01', '07:00', true),
    note('far', '2027-01-01', null, false),
  ];

  it('shows the selected day, else coming notes topped up with recent ones', () => {
    expect(notesToShow(notes, '2026-09-01', 3, now).map((n) => n.id)).toEqual(['old']);
    expect(notesToShow(notes, null, 3, now).map((n) => n.id)).toEqual(['soon', 'later', 'next']);
    expect(notesToShow(notes.slice(0, 2), '2026-08-01', 3, now).map((n) => n.id)).toEqual(['soon', 'old']);
  });

  it('keeps only reminders still ahead, soonest first', () => {
    expect(upcomingReminders(notes, now).map((n) => n.id)).toEqual(['later', 'next']);
  });
});
