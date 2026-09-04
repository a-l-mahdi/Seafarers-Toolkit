import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DocumentListRow } from '@/database/repositories';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
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
 */
export async function syncNotifications(documents: DocumentListRow[]): Promise<void> {
  const prefs = await getNotificationPrefs();
  const today = todayISO();

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    if (!prefs.documentExpiry) continue;

    for (const threshold of prefs.thresholds) {
      const daysLeft = diffInDays(today, doc.expiryDate);
      if (daysLeft < 0 || daysLeft > threshold) continue;
      if (daysLeft !== threshold && doc.status !== 'expired') continue;

      const inserted = await NotificationsRepo.upsertNotification({
        eventType: 'document',
        eventId: doc.id,
        notificationType: `expiry_${threshold}d`,
        title: doc.name,
        body:
          daysLeft <= 0
            ? `${doc.name} has expired.`
            : `${doc.name} expires in ${daysLeft} days.`,
        scheduledAt: null,
        sentAt: isoNow(),
      });
      if (inserted && daysLeft > 0) {
        await scheduleOsNotification(
          doc.name,
          `${doc.name} expires in ${daysLeft} days.`,
          new Date(`${doc.expiryDate}T09:00:00`)
        );
      }
    }
  }
}
