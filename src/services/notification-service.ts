import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import type { DocumentListRow } from '@/database/repositories';
import { listDocuments } from '@/database/repositories/documents-repository';
import { isoNow, todayISO } from '@/utils/date';
import { documentStatus } from '@/domain/document-status';
import type { DocumentStatusType } from '@/types/domain';
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

/** Presents a banner right now (no server / FCM needed — this is a local notification). */
async function presentNow(title: string, body: string, documentId: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { documentId } },
      trigger: null, // immediate
    });
  } catch {
    // best-effort
  }
}

/** Schedules a local banner for a future date (fires even if the app is closed;
 *  restored after reboot by the library's boot receiver). Inexact by default, so
 *  no SCHEDULE_EXACT_ALARM permission is required. */
async function scheduleAt(title: string, body: string, fireDate: Date, documentId: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { documentId } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: fireDate, channelId: CHANNEL_ID },
    });
  } catch {
    // best-effort
  }
}

// --- date helpers ---------------------------------------------------------

/** yyyy-mm-dd minus N days, back to yyyy-mm-dd. */
function isoMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** A local Date at 09:00 on the given day; if that moment is already past, a few
 *  seconds from now so the banner still fires. */
function fireMomentFor(iso: string): Date {
  const at9 = new Date(`${iso}T09:00:00`);
  const now = Date.now();
  return at9.getTime() <= now ? new Date(now + 5000) : at9;
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
export async function syncNotifications(documents: DocumentListRow[]): Promise<void> {
  const prefs = await getNotificationPrefs();
  if (!prefs.documentExpiry) return;
  const today = todayISO();
  const now = new Date();

  // Rebuild the OS schedule from scratch so edits/deletes never leave stale alarms.
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // best-effort
  }
  await NotificationsRepo.pruneDocumentNotifications(documents.map((d) => d.id));

  for (const doc of documents) {
    const status = documentStatus(
      {
        expiryDate: doc.expiryDate,
        warningThresholdDays: doc.warningThresholdDays,
        validThresholdDays: doc.validThresholdDays,
      },
      now
    );

    for (const ev of eventsFor(doc)) {
      const existing = await NotificationsRepo.getNotification('document', doc.id, ev.type);

      if (ev.fireISO >= today) {
        // Upcoming (or today): (re)schedule the banner and keep a hidden pending row.
        await scheduleAt(ev.title, ev.body, fireMomentFor(ev.fireISO), doc.id);
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

      // The event's day is in the past.
      if (existing) {
        if (!existing.sentAt) {
          // We had scheduled it; its banner has already fired while away — just
          // surface it in the centre now (no duplicate banner).
          await NotificationsRepo.markDelivered(existing.id, `${ev.fireISO}T09:00:00`);
        }
        continue;
      }

      // Never seen before and already past: the user added a doc that is already
      // in this state. Only surface the document's current (most-severe) stage.
      if (EVENT_SEVERITY[ev.kind] < statusSeverity(status)) continue;
      const inserted = await NotificationsRepo.upsertNotification({
        eventType: 'document',
        eventId: doc.id,
        notificationType: ev.type,
        title: ev.title,
        body: ev.body,
        scheduledAt: null,
        sentAt: isoNow(),
      });
      if (inserted) await presentNow(ev.title, ev.body, doc.id);
    }
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

/** Lists documents and reconciles notifications — call after any document change. */
export async function resyncDocumentNotifications(): Promise<void> {
  try {
    const docs = await listDocuments();
    await syncNotifications(docs);
  } catch {
    // notifications sync is best-effort
  }
}
