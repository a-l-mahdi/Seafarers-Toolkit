import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { useDocuments } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import type { DocumentListRow } from '@/hooks/queries';

const STATUS_TONE = {
  valid: 'success',
  expiring_soon: 'warning',
  not_valid: 'danger',
  expired: 'danger',
  no_expiry: 'muted',
} as const;

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
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Link href="/document-scan" style={{ color: colors.primary, fontWeight: '600' }}>
                {t('documents.scan.title')}
              </Link>
              <Link href="/document-form" style={{ color: colors.primary, fontWeight: '600' }}>
                + {t('common.add')}
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
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
  return (
    <Link href={`/document-form?id=${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {item.typeName ?? '—'}
            {item.expiryDate ? ` · ${t('documents.expiryDate')}: ${formatDate(item.expiryDate)}` : ''}
          </Text>
        </View>
        <Badge label={t(`documents.status.${item.status}`)} tone={STATUS_TONE[item.status]} />
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
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
});
