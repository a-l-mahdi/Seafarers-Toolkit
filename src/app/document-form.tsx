import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, FieldRow } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
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
  importUriFile,
  isAllowedFileType,
  pickDocumentFile,
  removeImportedFile,
} from '@/services/file-storage';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { useFormattedDate } from '@/hooks/use-date-format';
import { DEFAULT_VALIDITY_DAYS } from '@/domain/document-status';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { DocumentListRow } from '@/hooks/queries';

const STATUS_TONE = {
  valid: 'success',
  expiring_soon: 'warning',
  not_valid: 'danger',
  expired: 'danger',
  no_expiry: 'muted',
} as const;

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
  const formatDate = useFormattedDate();
  const { data: types } = useDocumentTypes();
  const save = useSaveDocument();
  const remove = useDeleteDocument();
  const addFile = useAddDocumentFile();

  const documentId = initial?.id ?? null;

  const [name, setName] = useState(initial?.name ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [typeId, setTypeId] = useState<string | null>(initial?.typeId ?? null);
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');
  const [warningThreshold, setWarningThreshold] = useState(
    initial?.warningThresholdDays?.toString() ?? '210'
  );
  const [validThreshold, setValidThreshold] = useState(
    initial?.validThresholdDays?.toString() ?? String(DEFAULT_VALIDITY_DAYS)
  );
  const [authority, setAuthority] = useState(initial?.issuingAuthority ?? '');
  const [country, setCountry] = useState(initial?.issuingCountry ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, setPending] = useState<DisplayFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Adds an image/file either directly (saved doc) or as pending (new doc). */
  const handleAdd = async (source: 'camera' | 'gallery' | 'file') => {
    let uri: string | null = null;
    let fileName: string;
    if (source === 'camera') {
      uri = await capturePhoto();
      fileName = `photo_${Date.now()}.jpg`;
    } else if (source === 'gallery') {
      uri = await pickPhoto();
      fileName = `photo_${Date.now()}.jpg`;
    } else {
      const picked = await pickDocumentFile();
      if (!picked) return;
      if (!isAllowedFileType(picked.mimeType, picked.name)) return;
      uri = picked.uri;
      fileName = picked.name;
    }
    if (!uri) return;
    if (documentId) {
      const localPath = await importUriFile(`documents/${documentId}`, uri, fileName);
      addFile.mutate({ documentId, localPath, fileName, mimeType: null, size: null });
    } else {
      setPending((p) => [...p, { id: uri, uri, name: fileName }]);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t('documents.errors.nameRequired'));
      return;
    }
    if (issueDate && expiryDate && expiryDate <= issueDate) {
      setError(t('documents.errors.expiryBeforeIssue'));
      return;
    }
    setSaving(true);
    try {
      const doc = await save.mutateAsync({
        id: initial?.id,
        name: name.trim(),
        number: number.trim() || null,
        typeId,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        issuingAuthority: authority.trim() || null,
        issuingCountry: country.trim() || null,
        warningThresholdDays: parseInt(warningThreshold, 10) || null,
        validThresholdDays: parseInt(validThreshold, 10) || null,
        notes: notes.trim() || null,
      });
      // Import pending attachments now that the document id exists.
      for (const file of pending) {
        try {
          const localPath = await importUriFile(`documents/${doc.id}`, file.uri, file.name);
          addFile.mutate({ documentId: doc.id, localPath, fileName: file.name, mimeType: null, size: null });
        } catch {
          // per-file copy is best-effort
        }
      }
      router.back();
    } finally {
      setSaving(false);
    }
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
        title={initial ? t('common.edit') : t('documents.add')}
        onBack={() => router.back()}
        action={initial ? { label: t('common.delete'), onPress: confirmDelete } : undefined}
      />
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.form}>
        {initial ? (
          <View style={styles.statusRow}>
            <Badge label={t(`documents.status.${initial.status}`)} tone={STATUS_TONE[initial.status]} />
          </View>
        ) : null}
        <LabeledInput label={t('documents.name')} value={name} onChangeText={setName} error={error} />
        <LabeledInput label={t('documents.number')} value={number} onChangeText={setNumber} />
        <Select
          label={t('documents.type')}
          value={typeId}
          options={(types ?? []).map((ty) => ({ id: ty.id, label: ty.name }))}
          onSelect={setTypeId}
        />
        <DatePickerField label={t('documents.issueDate')} value={issueDate} onChange={setIssueDate} />
        <DatePickerField label={t('documents.expiryDate')} value={expiryDate} onChange={setExpiryDate} />
        <LabeledInput
          label={t('documents.warningThreshold')}
          value={warningThreshold}
          onChangeText={setWarningThreshold}
          keyboardType="numeric"
        />
        <LabeledInput
          label={t('documents.validThreshold')}
          value={validThreshold}
          onChangeText={setValidThreshold}
          keyboardType="numeric"
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: Spacing.md }}>
          {t('documents.thresholdHint')}
        </Text>
        <LabeledInput label={t('documents.authority')} value={authority} onChangeText={setAuthority} />
        <LabeledInput label={t('documents.country')} value={country} onChangeText={setCountry} />
        <LabeledInput label={t('documents.notes')} value={notes} onChangeText={setNotes} multiline />
        <DocumentFilesSection
          documentId={documentId}
          pending={pending}
          onRemovePending={(id) => setPending((p) => p.filter((f) => f.id !== id))}
          onAdd={(source) => void handleAdd(source)}
        />
        {initial ? <FieldRow label={t('documents.expiryDate')} value={formatDate(initial.expiryDate)} /> : null}
        <View style={styles.actions}>
          <Button
            label={saving ? t('common.loading') : t('common.save')}
            onPress={() => void submit()}
            style={styles.flexBtn}
            disabled={saving}
          />
          {initial ? (
            <Button label={t('common.delete')} onPress={confirmDelete} variant="danger" style={styles.flexBtn} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function DocumentFilesSection({
  documentId,
  pending,
  onRemovePending,
  onAdd,
}: {
  documentId: string | null;
  pending: DisplayFile[];
  onRemovePending: (id: string) => void;
  onAdd: (source: 'camera' | 'gallery' | 'file') => void;
}) {
  const { t } = useTranslation();
  const { data: savedFiles } = useDocumentFiles(documentId);
  const deleteFile = useDeleteDocumentFile();

  const saved: DisplayFile[] = (savedFiles ?? []).map((f) => ({
    id: f.id,
    uri: f.localPath,
    name: f.fileName,
  }));
  const all = [...saved, ...pending];

  const removeFile = (id: string) => {
    const savedFile = savedFiles?.find((f) => f.id === id);
    if (savedFile && documentId) {
      void removeImportedFile(savedFile.localPath);
      deleteFile.mutate({ id, documentId });
    } else {
      onRemovePending(id);
    }
  };

  return (
    <View style={styles.filesSection}>
      <FieldRow label={t('documents.files')} value={String(all.length)} />
      <FileGallery files={all} onRemove={(id) => removeFile(id)} />
      <View style={styles.fileActions}>
        <AddLink label={t('tripFiles.camera')} onPress={() => onAdd('camera')} />
        <AddLink label={t('tripFiles.gallery')} onPress={() => onAdd('gallery')} />
        <AddLink label={t('tripFiles.pdf')} onPress={() => onAdd('file')} />
      </View>
    </View>
  );
}

function AddLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useTheme();
  return (
    <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={onPress}>
      + {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  statusRow: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
  filesSection: { marginTop: Spacing.sm, gap: Spacing.sm },
  fileActions: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap' },
});
