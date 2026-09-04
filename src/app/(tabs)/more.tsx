import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function MoreScreen() {
  const { t } = useTranslation();
  const colors = useTheme();

  const items: { href: string; label: string }[] = [
    { href: '/sea-time', label: t('more.seaTime') },
    { href: '/vessels', label: t('more.vessels') },
    { href: '/calendar', label: t('more.calendar') },
    { href: '/reports', label: t('more.reports') },
    { href: '/notifications', label: t('more.notifications') },
    { href: '/profile-form', label: t('more.profile') },
    { href: '/ranks', label: t('more.ranks') },
    { href: '/settings', label: t('more.settings') },
  ];

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
      <Card>
        {items.map((item, index) => (
          <Link key={item.href} href={item.href as never} asChild>
            <Text
              style={[
                styles.item,
                { color: colors.text, borderBottomColor: colors.border },
                index === items.length - 1 && styles.last,
              ]}
            >
              {item.label}
              <Text style={{ color: colors.textMuted }}>{'  ›'}</Text>
            </Text>
          </Link>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  item: {
    fontSize: 16,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  last: { borderBottomWidth: 0 },
});
