import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { useFloatingTabBarPadding } from '@/components/floating-tab-bar';
import { useTabScrollReset, withTabStrip } from '@/components/tab-strip';

type Item = { href: string; icon: keyof typeof Ionicons.glyphMap };

/** Grouped like a settings screen: everyday tools first, then career records,
 *  then the reference lists they draw on, and Settings last on its own. */
const GROUPS: Item[][] = [
  [
    { href: '/calendar', icon: 'calendar' },
    { href: '/checklist', icon: 'checkbox' },
    { href: '/notifications', icon: 'notifications' },
  ],
  [
    { href: '/cv', icon: 'document-text' },
    { href: '/reports', icon: 'stats-chart' },
  ],
  [
    { href: '/vessels', icon: 'boat' },
    { href: '/ranks', icon: 'ribbon' },
    { href: '/document-types', icon: 'pricetags' },
  ],
  [{ href: '/settings', icon: 'settings' }],
];

function MoreScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const scrollRef = useTabScrollReset<ScrollView>();
  const tabPad = useFloatingTabBarPadding();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}
        style={{ backgroundColor: colors.background }}
      >
        {GROUPS.map((items, g) => (
          <View key={g} style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {items.map((item, index) => (
              <Link key={item.href} href={item.href as never} asChild>
                <Pressable
                  android_ripple={{ color: colors.primaryMuted }}
                  style={[
                    styles.item,
                    { borderBottomColor: colors.border },
                    index === items.length - 1 && styles.lastItem,
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
        ))}
      </ScrollView>
    </View>
  );
}

function toLabelKey(href: string): string {
  switch (href) {
    case '/cv':
      return 'more.cv';
    case '/checklist':
      return 'more.checklist';
    case '/vessels':
      return 'more.vessels';
    case '/document-types':
      return 'more.documentTypes';
    case '/calendar':
      return 'more.calendar';
    case '/reports':
      return 'more.reports';
    case '/notifications':
      return 'more.notifications';
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
  content: { flexGrow: 1, gap: Spacing.lg, paddingBottom: Spacing.xl },
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

export default withTabStrip(MoreScreen, 4);
