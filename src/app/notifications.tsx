import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  // Opening the list clears the phone's notification tray.
  useEffect(() => {
    Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  }, []);

  const openNotification = (eventType: string, eventId: string, id: string, type: string) => {
    if (eventType === 'document') {
      router.push({ pathname: '/document-alert', params: { id: eventId } });
    } else if (eventType === 'contract') {
      // Trip reminder → the trip, with the "don't forget your things" popup.
      markRead.mutate(id);
      router.push({ pathname: '/contract-detail', params: { id: eventId, reminder: type.split('_')[0] } });
    } else if (eventType === 'note') {
      // Note reminder → the calendar, on that note.
      markRead.mutate(id);
      router.push({ pathname: '/calendar', params: { note: eventId } });
    } else {
      markRead.mutate(id);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TelegramHeader
        title={t('notifications.title')}
        onBack={() => router.back()}
        actions={[
          { icon: 'checkmark-done', label: t('notifications.markAllRead'), onPress: () => markAllRead.mutate() },
        ]}
      />
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}>
        {(notifications ?? []).length === 0 ? (
          <EmptyState title={t('notifications.empty')} />
        ) : null}
        {(notifications ?? []).map((n) => (
          <Pressable
            key={n.id}
            onPress={() => openNotification(n.eventType, n.eventId, n.id, n.notificationType)}
            style={[
              styles.row,
              n.readAt
                ? { backgroundColor: colors.surface, borderColor: colors.border }
                : { backgroundColor: colors.primaryMuted, borderColor: colors.primary, borderLeftWidth: 3 },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: n.readAt ? '400' : '700' }}>{n.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{n.body}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {t(`notifications.types.${n.notificationType.split('_')[0]}` as never)} · {n.createdAt.slice(0, 10)}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {!n.readAt ? (
                <Text style={{ color: colors.primary }} onPress={() => markRead.mutate(n.id)}>
                  ✓
                </Text>
              ) : null}
              <Text style={{ color: colors.textMuted }} onPress={() => dismiss.mutate(n.id)}>
                ✕
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
});
