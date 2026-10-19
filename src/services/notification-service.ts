import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import type { ContractListRow, DocumentListRow } from '@/database/repositories';
import { listDocuments } from '@/database/repositories/documents-repository';
import { listContracts } from '@/database/repositories/vessels-repository';
import { pruneFinishedTripChecklists } from '@/database/repositories/checklist-repository';
import { listCalendarNotes } from '@/database/repositories/calendar-notes-repository';
import { isoNow, todayISO } from '@/utils/date';
import { documentStatus } from '@/domain/document-status';
import type { CalendarNote, DocumentStatusType } from '@/types/domain';
import * as NotificationsRepo from '@/database/repositories/notifications-repository';
import { getNotificationPrefs } from '@/database/repositories/ranks-repository';
import i18n from '@/i18n';

const CHANNEL_ID = 'alerts';

export async function initNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (!existing.granted) {
    await Notifications.requestPermissionsAsync();
  }
}

// --- scheduling plan ----------------------------------------------------

/** One OS banner the sync wants scheduled. */
interface Planned {
  identifier: string;
  content: Notifications.NotificationContentInput;
  date: Date;
}

type BannerContent = { title: string; body: string; data: Record<string, unknown> };

/** Banners fired "now" are one-offs: a later sync must never cancel them before they show. */
const NOW_PREFIX = 'now:';

/** Short stable hash, so a changed title / body (e.g. another language) reschedules the banner. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Plans a banner for `date`. Its identifier carries the key, the moment and the text, so an
 *  unchanged reminder keeps its identifier and the next sync leaves it alone. */
function plan(out: Planned[], key: string, date: Date, content: BannerContent): void {
  out.push({
    identifier: `${key}@${date.getTime()}#${hash(`${content.title}|${content.body}`)}`,
    content: { ...content, sound: 'default' },
    date,
  });
}

/** Plans a banner that shows right away (a local notification, no server / FCM needed),
 *  on the high-importance 'alerts' channel so it appears as a heads-up. */
function planNow(out: Planned[], key: string, content: BannerContent): void {
  out.push({
    identifier: `${NOW_PREFIX}${key}@${Date.now()}`,
    content: { ...content, sound: 'default' },
    date: new Date(Date.now() + 1000),
  });
}

/**
 * Brings the OS schedule in line with the plan, touching only what changed: banners no
 * longer wanted are cancelled, new or changed ones scheduled, unchanged ones left alone.
 * (Cancelling and rescheduling everything after every save was slow with many entries.)
 * Inexact DATE triggers, so no SCHEDULE_EXACT_ALARM permission is required; the library's
 * boot receiver restores them after a reboot.
 */
async function applyPlan(planned: Planned[]): Promise<void> {
  const wanted = new Set(planned.map((p) => p.identifier));
  const have = new Set<string>();
  try {
    for (const req of await Notifications.getAllScheduledNotificationsAsync()) {
      if (wanted.has(req.identifier) || req.identifier.startsWith(NOW_PREFIX)) have.add(req.identifier);
      else await Notifications.cancelScheduledNotificationAsync(req.identifier);
    }
  } catch {
    // best-effort
  }
  for (const p of planned) {
    if (have.has(p.identifier)) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: p.identifier,
        content: p.content,
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL_ID },
      });
    } catch {
      // best-effort
    }
  }
}

type NotificationIndex = Awaited<ReturnType<typeof NotificationsRepo.loadNotificationIndex>>;
const indexKey = (eventType: string, eventId: string, type: string) => `${eventType}|${eventId}|${type}`;

// --- date helpers ---------------------------------------------------------

/** yyyy-mm-dd minus N days, back to yyyy-mm-dd. */
function isoMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Local 09:00 on the given day. */
function nineOn(iso: string): Date {
  return new Date(`${iso}T09:00:00`);
}

// --- severity gate --------------------------------------------------------

const EVENT_SEVERITY = { warning: 1, validity: 2, expired: 3 } as const;
type EventKind = keyof typeof EVENT_SEVERITY;

function statusSeverity(status: DocumentStatusType): number {
  switch (status) {
    case 'expired':
      return 3;
    case 'not_valid':
      return 2;
    case 'expiring_soon':
      return 1;
    default:
      return 0;
  }
}

interface DocEvent {
  kind: EventKind;
  type: string; // dedupe key stored in DB
  fireISO: string;
  title: string;
  body: string;
}

/** The events a document can raise, most-severe first. */
function eventsFor(doc: DocumentListRow): DocEvent[] {
  if (!doc.expiryDate) return [];
  const name = doc.name;
  const warning = doc.warningThresholdDays ?? 30;
  const validity = doc.validThresholdDays ?? 0;
  const events: DocEvent[] = [];

  events.push({
    kind: 'expired',
    type: 'expired',
    fireISO: doc.expiryDate,
    title: name,
    body: i18n.t('notifications.msg.expired', { name }),
  });
  if (validity > 0) {
    events.push({
      kind: 'validity',
      type: `validity_${validity}d`,
      fireISO: isoMinusDays(doc.expiryDate, validity),
      title: name,
      body: i18n.t('notifications.msg.validity', { name, days: validity }),
    });
  }
  if (warning > 0) {
    events.push({
      kind: 'warning',
      type: `expiry_${warning}d`,
      fireISO: isoMinusDays(doc.expiryDate, warning),
      title: name,
      body: i18n.t('notifications.msg.warning', { name, days: warning }),
    });
  }
  return events;
}

/**
 * Reconciles OS notifications and the in-app notification centre against the
 * current documents. Runs at startup and after any document change.
 *
 * Model (commercial-grade, fires exactly once per event):
 *  - Future event  → schedule a local OS banner for its day; keep a hidden
 *    "pending" row (sent_at NULL). Re-scheduling every sync (after cancel-all)
 *    keeps it correct when the user edits a date.
 *  - Event that already fired while away (pending row, day now passed) → mark it
 *    delivered so it shows in the centre, WITHOUT a second banner.
 *  - Event already past when first seen (e.g. the user just added an expired doc)
 *    → present a banner now and record it delivered, once. A less-severe stage
 *    that a document has already moved past is skipped so we don't, say, fire a
 *    renewal reminder for a document that is already expired.
 */
export async function syncNotifications(documents: DocumentListRow[], contracts?: ContractListRow[]): Promise<void> {
  const prefs = await getNotificationPrefs();
  const allContracts = contracts ?? (await listContracts());
  // One read of every stored row instead of a query per reminder.
  const index = await NotificationsRepo.loadNotificationIndex();
  // The OS schedule is reconciled against this plan at the end, so edits and deletes
  // never leave stale alarms.
  const planned: Planned[] = [];

  if (prefs.documentExpiry) await syncDocumentEvents(documents, index, planned);
  if (prefs.contractEnding) await syncContractEvents(allContracts, index, planned);
  // Note reminders were asked for explicitly, so they always run.
  await syncNoteEvents(await listCalendarNotes(), index, planned);
  await applyPlan(planned);
  await pruneFinishedTripChecklists();
}

async function syncDocumentEvents(documents: DocumentListRow[], index: NotificationIndex, out: Planned[]) {
  const today = todayISO();
  const now = new Date();
  await NotificationsRepo.pruneDocumentNotifications(documents.map((d) => d.id));

  for (const doc of documents) {
    const status = documentStatus(
      {
        expiryDate: doc.expiryDate,
        warningThresholdDays: doc.warningThresholdDays,
        validThresholdDays: doc.validThresholdDays,
      },
      now,
    );

    for (const ev of eventsFor(doc)) {
      const existing = index.get(indexKey('document', doc.id, ev.type)) ?? null;
      const content = { title: ev.title, body: ev.body, data: { documentId: doc.id } };
      const at = nineOn(ev.fireISO);

      if (at.getTime() > now.getTime()) {
        // Upcoming: keep its banner scheduled and a hidden pending row.
        plan(out, `doc:${doc.id}:${ev.type}`, at, content);
        if (!existing) {
          await NotificationsRepo.upsertNotification({
            eventType: 'document',
            eventId: doc.id,
            notificationType: ev.type,
            title: ev.title,
            body: ev.body,
            scheduledAt: ev.fireISO,
            sentAt: null,
          });
        }
        continue;
      }

      // Its moment has passed.
      if (existing) {
        if (!existing.sentAt) {
          // We had scheduled it; its banner has already fired — just surface it in
          // the centre now (no duplicate banner).
          await NotificationsRepo.markDelivered(existing.id, `${ev.fireISO}T09:00:00`);
        }
        continue;
      }

      // Never seen before: due today, or the user added a doc that is already in
      // this state. For past days only surface the document's current (most-severe) stage.
      if (ev.fireISO < today && EVENT_SEVERITY[ev.kind] < statusSeverity(status)) continue;
      const inserted = await NotificationsRepo.upsertNotification({
        eventType: 'document',
        eventId: doc.id,
        notificationType: ev.type,
        title: ev.title,
        body: ev.body,
        scheduledAt: null,
        sentAt: isoNow(),
      });
      if (inserted) planNow(out, `doc:${doc.id}:${ev.type}`, content);
    }
  }
}

// --- trip reminders (contract start / end) --------------------------------

export type TripReminder = 'departure' | 'return';

interface ContractEvent {
  reminder: TripReminder;
  /** Dedupe key; carries the date so moving the date creates a fresh reminder. */
  type: string;
  /** The join / sign-off day the reminder is about. */
  eventISO: string;
  fireAt: Date;
  title: string;
  body: string;
}

/** Local 12:00 on the day before `iso`. */
function noonDayBefore(iso: string): Date {
  return new Date(`${isoMinusDays(iso, 1)}T12:00:00`);
}

/** A trip gets a packing reminder at noon the day before it starts and the day
 *  before its expected sign-off, until it is signed off. */
function contractEventsFor(c: ContractListRow): ContractEvent[] {
  if (c.actualSignOff) return [];
  const vessel = c.vesselName ?? '—';
  const returnISO = c.expectedSignOff;
  return [
    {
      reminder: 'departure',
      type: `departure_${c.joinDate}`,
      eventISO: c.joinDate,
      fireAt: noonDayBefore(c.joinDate),
      title: i18n.t('notifications.msg.departureTitle'),
      body: i18n.t('notifications.msg.departure', { vessel }),
    },
    {
      reminder: 'return',
      type: `return_${returnISO}`,
      eventISO: returnISO,
      fireAt: noonDayBefore(returnISO),
      title: i18n.t('notifications.msg.returnTitle'),
      body: i18n.t('notifications.msg.return', { vessel }),
    },
  ];
}

const contractContent = (ev: ContractEvent, contractId: string): BannerContent => ({
  title: ev.title,
  body: ev.body,
  data: { contractId, reminder: ev.reminder, eventType: 'contract', eventId: contractId, notificationType: ev.type },
});

/**
 * Same model as documents: future reminders are scheduled with a hidden pending
 * row; a reminder whose time passed while away is surfaced in the centre; one
 * that is due for a trip still ahead (e.g. the trip was added the evening before)
 * fires now, once. Reminders for days already gone are never raised late.
 */
async function syncContractEvents(
  contracts: ContractListRow[],
  index: NotificationIndex,
  out: Planned[],
  now: Date = new Date(),
): Promise<void> {
  const current = new Map<string, string[]>();
  for (const c of contracts)
    current.set(
      c.id,
      contractEventsFor(c).map((e) => e.type),
    );
  await NotificationsRepo.pruneEventNotifications('contract', current);
  const today = todayISO(now);

  for (const c of contracts) {
    for (const ev of contractEventsFor(c)) {
      const existing = index.get(indexKey('contract', c.id, ev.type)) ?? null;
      if (ev.fireAt.getTime() > now.getTime()) {
        plan(out, `trip:${c.id}:${ev.type}`, ev.fireAt, contractContent(ev, c.id));
        if (!existing) {
          await NotificationsRepo.upsertNotification({
            eventType: 'contract',
            eventId: c.id,
            notificationType: ev.type,
            title: ev.title,
            body: ev.body,
            scheduledAt: ev.fireAt.toISOString(),
            sentAt: null,
          });
        }
        continue;
      }
      if (existing) {
        if (!existing.sentAt) await NotificationsRepo.markDelivered(existing.id, ev.fireAt.toISOString());
        continue;
      }
      if (today >= ev.eventISO) continue;
      const inserted = await NotificationsRepo.upsertNotification({
        eventType: 'contract',
        eventId: c.id,
        notificationType: ev.type,
        title: ev.title,
        body: ev.body,
        scheduledAt: null,
        sentAt: isoNow(),
      });
      if (inserted) planNow(out, `trip:${c.id}:${ev.type}`, contractContent(ev, c.id));
    }
  }
}

// --- calendar note reminders ----------------------------------------------

/** The moment a note reminder fires (local date + time), or null if it has none. */
export function noteFireAt(note: Pick<CalendarNote, 'date' | 'time' | 'remind'>): Date | null {
  if (!note.remind || !note.time || !/^\d{2}:\d{2}$/.test(note.time)) return null;
  const at = new Date(`${note.date}T${note.time}:00`);
  return Number.isNaN(at.getTime()) ? null : at;
}

const noteType = (note: CalendarNote) => `note_${note.date}T${note.time}`;

/**
 * Note reminders fire at the note's own date and time. A future reminder is
 * scheduled with a hidden pending row; once its time passes the row shows in
 * the centre. A reminder whose time had already passed when it was saved is
 * never raised late.
 */
async function syncNoteEvents(
  notes: CalendarNote[],
  index: NotificationIndex,
  out: Planned[],
  now: Date = new Date(),
): Promise<void> {
  const current = new Map<string, string[]>();
  for (const n of notes) current.set(n.id, noteFireAt(n) ? [noteType(n)] : []);
  await NotificationsRepo.pruneEventNotifications('note', current);

  for (const note of notes) {
    const fireAt = noteFireAt(note);
    if (!fireAt) continue;
    const type = noteType(note);
    const title = i18n.t('notifications.msg.noteTitle');
    const body = note.text;
    const existing = index.get(indexKey('note', note.id, type)) ?? null;
    if (fireAt.getTime() > now.getTime()) {
      plan(out, `note:${note.id}:${type}`, fireAt, {
        title,
        body,
        data: { noteId: note.id, eventType: 'note', eventId: note.id, notificationType: type },
      });
      if (existing) {
        await NotificationsRepo.updatePendingContent(existing.id, title, body);
      } else {
        await NotificationsRepo.upsertNotification({
          eventType: 'note',
          eventId: note.id,
          notificationType: type,
          title,
          body,
          scheduledAt: fireAt.toISOString(),
          sentAt: null,
        });
      }
      continue;
    }
    if (existing && !existing.sentAt) await NotificationsRepo.markDelivered(existing.id, fireAt.toISOString());
  }
}

/** Removes a contract's delivered banners from the status bar. */
export async function clearDeliveredForContract(contractId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      if (n.request.content.data?.contractId === contractId) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // best-effort
  }
}

/** Removes any delivered banners for one document from the status bar (called when
 *  the user opens that document's alert). */
export async function clearDeliveredForDocument(documentId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      if (n.request.content.data?.documentId === documentId) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // best-effort
  }
}

let resyncing: Promise<void> | null = null;
let resyncAgain = false;

/** Reloads documents and contracts and reconciles every reminder — call after
 *  any document or contract change. */
export function resyncNotifications(): Promise<void> {
  // Runs in the background after saves; overlapping calls are folded into one more
  // pass after the current one, so two reschedules never race each other.
  if (resyncing) {
    resyncAgain = true;
    return resyncing;
  }
  resyncing = (async () => {
    do {
      resyncAgain = false;
      try {
        const [docs, contracts] = await Promise.all([listDocuments(), listContracts()]);
        await syncNotifications(docs, contracts);
      } catch {
        // notifications sync is best-effort
      }
    } while (resyncAgain);
    resyncing = null;
  })();
  return resyncing;
}

const RESYNC_DELAY_MS = 1200;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let resyncWaiters: (() => void)[] = [];

/** Reconciles reminders shortly after a change — call after any save or delete. A run of
 *  saves (e.g. editing several contracts one after another) is folded into one pass that
 *  starts once they stop, so the reschedule never competes with the user's edits. */
export function requestResync(): Promise<void> {
  return new Promise((resolve) => {
    resyncWaiters.push(resolve);
    if (resyncTimer) clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => {
      resyncTimer = null;
      const waiters = resyncWaiters;
      resyncWaiters = [];
      void resyncNotifications().then(() => waiters.forEach((w) => w()));
    }, RESYNC_DELAY_MS);
  });
}

/** Asks for the notification permission if it is not granted yet; true when banners can show. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
