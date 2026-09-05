import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import type { DocumentListRow } from '@/database/repositories';
import { diffInDays, isoNow, todayISO } from '@/utils/date';
import * as NotificationsRepo from '@/database/repositories/notifications-repository';
import { getNotificationPrefs } from '@/database/repositories/ranks-repository';

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
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (!existing.granted) {
    await Notifications.requestPermissionsAsync();
  }
}

const CHANNEL_ID = 'alerts';

async function scheduleOsNotification(
  title: string,
  body: string,
  fireDate: Date
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    // Scheduling is best-effort (e.g. permission denied).
  }
}

/**
 * Rebuilds notification-center entries and schedules OS notifications.
 * Dedup is enforced by the DB unique index (event_type, event_id, notification_type),
 * so repeated syncs never duplicate notifications.
 * Each document carries its own thresholds:
 *  - warningThresholdDays: renewal reminder (e.g. 210 = 1 month before the 6-month rule)
 *  - validThresholdDays: the day the document stops being valid to join (e.g. 180)
 */
export async function syncNotifications(documents: DocumentListRow[]): Promise<void> {
  const prefs = await getNotificationPrefs();
  if (!prefs.documentExpiry) return;
  const today = todayISO();

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const daysLeft = diffInDays(today, doc.expiryDate);

    if (daysLeft <= 0) {
      await pushNotification(doc, 'expired', `${doc.name} has expired.`, null);
      continue;
    }

    const warningThreshold = doc.warningThresholdDays ?? 30;
    const validThreshold = doc.validThresholdDays ?? 0;

    if (daysLeft === warningThreshold) {
      await pushNotification(
        doc,
        `expiry_${warningThreshold}d`,
        `${doc.name} expires in ${daysLeft} days — renew now.`,
        new Date(`${doc.expiryDate}T09:00:00`)
      );
    }

    if (validThreshold > 0 && daysLeft === validThreshold) {
      await pushNotification(
        doc,
        `validity_${validThreshold}d`,
        `${doc.name} is below the ${validThreshold}-day join validity in ${daysLeft} days.`,
        new Date(`${doc.expiryDate}T09:00:00`)
      );
    }
  }
}

async function pushNotification(
  doc: DocumentListRow,
  type: string,
  body: string,
  fireDate: Date | null
): Promise<void> {
  const inserted = await NotificationsRepo.upsertNotification({
    eventType: 'document',
    eventId: doc.id,
    notificationType: type,
    title: doc.name,
    body,
    scheduledAt: null,
    sentAt: isoNow(),
  });
  if (inserted && fireDate) {
    await scheduleOsNotification(doc.name, body, fireDate);
  }
}
