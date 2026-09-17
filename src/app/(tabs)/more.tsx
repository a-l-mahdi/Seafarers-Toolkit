import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const ITEMS: { href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { href: '/cv', icon: 'document-text' },
  { href: '/sea-time', icon: 'water' },
  { href: '/vessels', icon: 'boat' },
  { href: '/calendar', icon: 'calendar' },
  { href: '/reports', icon: 'stats-chart' },
  { href: '/notifications', icon: 'notifications' },
  { href: '/profile-form', icon: 'person' },
  { href: '/ranks', icon: 'ribbon' },
  { href: '/settings', icon: 'settings' },
];

export default function MoreScreen() {
  const { t } = useTranslation();
  const colors = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('more.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content} style={{ backgroundColor: colors.background }}>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ITEMS.map((item, index) => (
            <Link key={item.href} href={item.href as never} asChild>
              <Pressable
                style={[
                  styles.item,
                  { borderBottomColor: colors.border },
                  index === ITEMS.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
                    <Ionicons name={item.icon} size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.label, { color: colors.text }]}>{t(toLabelKey(item.href))}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function toLabelKey(href: string): string {
  switch (href) {
    case '/cv':
      return 'more.cv';
    case '/sea-time':
      return 'more.seaTime';
    case '/vessels':
      return 'more.vessels';
    case '/calendar':
      return 'more.calendar';
    case '/reports':
      return 'more.reports';
    case '/notifications':
      return 'more.notifications';
    case '/profile-form':
      return 'more.profile';
    case '/ranks':
      return 'more.ranks';
    case '/settings':
      return 'more.settings';
    default:
      return 'more.title';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, paddingTop: Spacing.md },
  content: { flexGrow: 1, paddingBottom: Spacing.xl },
  list: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastItem: { borderBottomWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '500', flex: 1 },
});
