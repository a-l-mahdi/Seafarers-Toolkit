import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, FieldRow } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import {
  useAddDocumentFile,
  useDeleteDocumentFile,
  useDocumentFiles,
  useDocumentTypes,
  useDocuments,
  useSaveDocument,
  useDeleteDocument,
} from '@/hooks/queries';
import {
  importPickedFile,
  isAllowedFileType,
  pickDocumentFile,
  removeImportedFile,
} from '@/services/file-storage';
import { isISODate } from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { DocumentListRow } from '@/hooks/queries';

export default function DocumentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: documents, isLoading } = useDocuments();
  const existing = documents?.find((d) => d.id === id) ?? null;

  if (id && !existing) {
    return (
      <View style={styles.container}>
        <Text>{isLoading ? '…' : 'Not found'}</Text>
      </View>
    );
  }
  return <DocumentForm key={existing?.id ?? 'new'} initial={existing} />;
}

function DocumentForm({ initial }: { initial: DocumentListRow | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const { data: types } = useDocumentTypes();
  const save = useSaveDocument();
  const remove = useDeleteDocument();

  const [name, setName] = useState(initial?.name ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [typeId, setTypeId] = useState<string | null>(initial?.typeId ?? null);
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');
  const [authority, setAuthority] = useState(initial?.issuingAuthority ?? '');
  const [country, setCountry] = useState(initial?.issuingCountry ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError(t('documents.errors.nameRequired'));
      return;
    }
    if (issueDate && expiryDate && isISODate(issueDate) && isISODate(expiryDate) && expiryDate <= issueDate) {
      setError(t('documents.errors.expiryBeforeIssue'));
      return;
    }
    save.mutate({
      id: initial?.id,
      name: name.trim(),
      number: number.trim() || null,
      typeId,
      issueDate: isISODate(issueDate) ? issueDate : null,
      expiryDate: isISODate(expiryDate) ? expiryDate : null,
      issuingAuthority: authority.trim() || null,
      issuingCountry: country.trim() || null,
      notes: notes.trim() || null,
    });
    router.back();
  };

  const confirmDelete = () => {
    if (!initial) return;
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove.mutate(initial.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar
        title={t('documents.add')}
        onBack={() => router.back()}
        action={initial ? { label: t('common.delete'), onPress: confirmDelete } : undefined}
      />
      <ScrollView contentContainerStyle={styles.form}>
        <LabeledInput label={t('documents.name')} value={name} onChangeText={setName} error={error} />
        <LabeledInput label={t('documents.number')} value={number} onChangeText={setNumber} />
        <Select
          label={t('documents.type')}
          value={typeId}
          options={(types ?? []).map((ty) => ({ id: ty.id, label: ty.name }))}
          onSelect={setTypeId}
        />
        <LabeledInput
          label={`${t('documents.issueDate')} (YYYY-MM-DD)`}
          value={issueDate}
          onChangeText={setIssueDate}
          placeholder="2026-01-31"
        />
        <LabeledInput
          label={`${t('documents.expiryDate')} (YYYY-MM-DD)`}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="2030-01-31"
        />
        <LabeledInput label={t('documents.authority')} value={authority} onChangeText={setAuthority} />
        <LabeledInput label={t('documents.country')} value={country} onChangeText={setCountry} />
        <LabeledInput label={t('documents.notes')} value={notes} onChangeText={setNotes} multiline />
        {initial ? <DocumentFilesSection documentId={initial.id} /> : null}
        <Button label={t('common.save')} onPress={submit} />
      </ScrollView>
    </View>
  );
}

function DocumentFilesSection({ documentId }: { documentId: string }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: files } = useDocumentFiles(documentId);
  const addFile = useAddDocumentFile();
  const deleteFile = useDeleteDocumentFile();

  const attach = async () => {
    const picked = await pickDocumentFile();
    if (!picked) return;
    if (!isAllowedFileType(picked.mimeType, picked.name)) return;
    const localPath = await importPickedFile(documentId, picked);
    addFile.mutate({
      documentId,
      localPath,
      fileName: picked.name,
      mimeType: picked.mimeType,
      size: picked.size,
    });
  };

  return (
    <View>
      <FieldRow label={t('documents.files')} value={String(files?.length ?? 0)} />
      {(files ?? []).map((file) => (
        <View key={file.id} style={styles.fileRow}>
          <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
            {file.fileName}
          </Text>
          <Text
            style={{ color: colors.danger }}
            onPress={() => {
              void removeImportedFile(file.localPath);
              deleteFile.mutate({ id: file.id, documentId });
            }}
          >
            ✕
          </Text>
        </View>
      ))}
      <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => void attach()}>
        + {t('documents.attachFile')} (PDF/JPG/PNG)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
});
