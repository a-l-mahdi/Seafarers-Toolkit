import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Card, EmptyState, FieldRow } from '@/components/ui/primitives';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import { useDocumentFiles, useDocuments, useMarkDocumentNotificationsRead } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { documentStatus, daysUntilExpiry } from '@/domain/document-status';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import type { DocumentListRow } from '@/hooks/queries';

const STATUS_TONE = {
  valid: 'success',
  expiring_soon: 'warning',
  not_valid: 'warning',
  expired: 'danger',
  no_expiry: 'muted',
} as const;

export default function DocumentAlertScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: documents } = useDocuments();
  const markRead = useMarkDocumentNotificationsRead();
  const doc = documents?.find((d) => d.id === id) ?? null;

  // Opening a document's alert marks its notifications read (they stay in the list)
  // and removes its banners from the status bar.
  useEffect(() => {
    if (id) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: doc?.name ?? t('documents.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      {doc ? <AlertBody doc={doc} /> : <EmptyState title={t('documents.notFound')} />}
    </View>
  );
}

function AlertBody({ doc }: { doc: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const { data: files } = useDocumentFiles(doc.id);

  const status = documentStatus(
    {
      expiryDate: doc.expiryDate,
      warningThresholdDays: doc.warningThresholdDays,
      validThresholdDays: doc.validThresholdDays,
    },
    new Date()
  );
  const days = doc.expiryDate ? daysUntilExpiry(doc.expiryDate) : null;

  let countdown: string;
  if (!doc.expiryDate) countdown = t('documents.status.no_expiry');
  else if (days !== null && days < 0) countdown = t('documentAlert.expiredAgo', { days: -days });
  else countdown = t('documentAlert.expiresIn', { days: days ?? 0 });

  const displayFiles: DisplayFile[] = (files ?? []).map((f) => ({
    id: f.id,
    uri: f.localPath,
    name: f.fileName,
  }));

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl + insets.bottom }]}
    >
      <View style={styles.statusRow}>
        <Badge label={t(`documents.status.${status}`)} tone={STATUS_TONE[status]} />
        <Text
          style={[
            styles.countdown,
            { color: status === 'expired' ? colors.danger : colors.text },
          ]}
        >
          {countdown}
        </Text>
      </View>

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('documentAlert.photos')}</Text>
        <FileGallery files={displayFiles} large emptyHint={t('documentAlert.noPhotos')} />
      </Card>

      <Card>
        <FieldRow label={t('documents.name')} value={doc.name} />
        {doc.number ? <FieldRow label={t('documents.number')} value={doc.number} /> : null}
        <FieldRow label={t('documents.issueDate')} value={formatDate(doc.issueDate)} />
        <FieldRow
          label={t('documents.expiryDate')}
          value={doc.expiryDate ? formatDate(doc.expiryDate) : t('documents.status.no_expiry')}
        />
        {doc.expiryDate ? (
          <FieldRow
            label={t('documents.daysLeft')}
            value={days !== null && days < 0 ? t('documentAlert.expiredNow') : String(days ?? 0)}
          />
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  countdown: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
});
