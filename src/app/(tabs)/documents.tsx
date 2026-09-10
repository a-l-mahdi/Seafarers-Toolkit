import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { useDocuments } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { diffInDays } from '@/utils/date';
import type { DocumentListRow } from '@/hooks/queries';

const STATUS_TONE = {
  valid: 'success',
  expiring_soon: 'warning',
  not_valid: 'warning',
  expired: 'danger',
  no_expiry: 'muted',
} as const;

/** Bar tone by validity state: yellow below the departure-validity threshold, red at expiry. */
function validityTone(status: DocumentListRow['status']): 'primary' | 'warning' | 'danger' {
  if (status === 'expired') return 'danger';
  if (status === 'not_valid' || status === 'expiring_soon') return 'warning';
  return 'primary';
}

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: documents, isLoading } = useDocuments();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('documents.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <Link href="/document-form" style={{ color: colors.primary, fontWeight: '600' }}>
              + {t('common.add')}
            </Link>
          ),
        }}
      />
      <FlatList nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        data={documents ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DocumentRow item={item} />}
        ListEmptyComponent={isLoading ? null : <EmptyState title={t('documents.noDocuments')} />}
      />
    </View>
  );
}

function DocumentRow({ item }: { item: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  // Remaining-validity fraction: daysLeft / (issue → expiry span, or 365 when no issue date).
  const totalValidity =
    item.expiryDate && item.issueDate
      ? diffInDays(item.issueDate, item.expiryDate)
      : item.expiryDate
        ? 365
        : 0;
  const validityProgress =
    totalValidity > 0 && item.daysUntilExpiry !== null
      ? Math.min(Math.max(item.daysUntilExpiry / totalValidity, 0), 1)
      : 0;
  return (
    <Link href={`/document-form?id=${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
            <Badge label={t(`documents.status.${item.status}`)} tone={STATUS_TONE[item.status]} />
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {item.typeName ?? '—'}
            {item.expiryDate ? ` · ${t('documents.expiryDate')}: ${formatDate(item.expiryDate)}` : ''}
            {item.daysUntilExpiry !== null ? ` · ${Math.max(item.daysUntilExpiry, 0)} ${t('documents.daysLeft')}` : ''}
          </Text>
          {item.expiryDate ? (
            <ProgressBar progress={validityProgress} tone={validityTone(item.status)} />
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
  info: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  meta: { fontSize: 13 },
});
