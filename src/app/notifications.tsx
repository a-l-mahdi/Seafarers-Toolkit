import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/primitives';
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
  const insets = useSafeAreaInsets();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('notifications.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <Pressable onPress={() => markAllRead.mutate()}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('notifications.markAllRead')}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.list, { paddingBottom: Spacing.xxl + insets.bottom }]}>
        {(notifications ?? []).length === 0 ? (
          <EmptyState title={t('notifications.empty')} />
        ) : null}
        {(notifications ?? []).map((n) => (
          <View key={n.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          </View>
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
