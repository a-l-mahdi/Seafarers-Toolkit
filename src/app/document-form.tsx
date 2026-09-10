import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, FieldRow } from '@/components/ui/primitives';
import { Checkbox, HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import {
  useAddDocumentFile,
  useCreateDocumentType,
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
import { parseDocumentText } from '@/services/ocr';
import { useFormattedDate } from '@/hooks/use-date-format';
import { DEFAULT_VALIDITY_DAYS } from '@/domain/document-status';
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
  const insets = useSafeAreaInsets();
  const formatDate = useFormattedDate();
  const { data: types } = useDocumentTypes();
  const createType = useCreateDocumentType();
  const save = useSaveDocument();
  const remove = useDeleteDocument();
  const addFile = useAddDocumentFile();

  const documentId = initial?.id ?? null;

  const [name, setName] = useState(initial?.name ?? '');
  const [number, setNumber] = useState(initial?.number ?? '');
  const [typeId, setTypeId] = useState<string | null>(initial?.typeId ?? null);
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');
  const [unlimited, setUnlimited] = useState(initial ? !initial.expiryDate : false);
  const [warningThreshold, setWarningThreshold] = useState(
    initial?.warningThresholdDays?.toString() ?? '210'
  );
  const [validThreshold, setValidThreshold] = useState(
    initial?.validThresholdDays?.toString() ?? String(DEFAULT_VALIDITY_DAYS)
  );
  const [authority, setAuthority] = useState(initial?.issuingAuthority ?? '');
  const [country, setCountry] = useState(initial?.issuingCountry ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [newTypeName, setNewTypeName] = useState('');
  const [pending, setPending] = useState<DisplayFile[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Attaches an image/file to the document. For camera/gallery captures the
   * image is also read with on-device OCR and matching fields are pre-filled.
   */
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

    if (source !== 'file') {
      // On-device OCR — no internet involved.
      setScanBusy(true);
      setScanFeedback(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
        const result = await TextRecognition.recognize(uri);
        const parsed = parseDocumentText(result?.text ?? '');
        let found = false;
        if (parsed.documentNumber) {
          setNumber(parsed.documentNumber);
          found = true;
        }
        if (parsed.issueDate) {
          setIssueDate(parsed.issueDate);
          found = true;
        }
        if (parsed.expiryDate) {
          setExpiryDate(parsed.expiryDate);
          setUnlimited(false);
          found = true;
        }
        setScanFeedback(found ? t('documents.scan.autoFilled') : t('documents.scan.nothingFound'));
      } catch {
        setScanFeedback(t('documents.scan.failed'));
      } finally {
        setScanBusy(false);
      }
    }

    if (documentId) {
      const localPath = await importUriFile(`documents/${documentId}`, uri, fileName);
      addFile.mutate({ documentId, localPath, fileName, mimeType: null, size: null });
    } else {
      setPending((p) => [...p, { id: uri, uri, name: fileName }]);
    }
  };

  const selectType = (id: string) => {
    setTypeId(id);
    // Pre-fill the document name from the selected type; the user can still edit it.
    const selected = (types ?? []).find((ty) => ty.id === id);
    if (selected) setName(selected.name);
  };

  const ensureType = async () => {
    const typeName = newTypeName.trim();
    if (!typeName) return;
    const created = await createType.mutateAsync(typeName);
    selectType(created.id);
    setNewTypeName('');
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t('documents.errors.nameRequired'));
      return;
    }
    if (!unlimited && issueDate && expiryDate && expiryDate <= issueDate) {
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
        expiryDate: unlimited ? null : expiryDate || null,
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.form, { paddingBottom: Spacing.xxl + insets.bottom }]}
        >
        {initial ? (
          <View style={styles.statusRow}>
            <Badge label={t(`documents.status.${initial.status}`)} tone={STATUS_TONE[initial.status]} />
          </View>
        ) : null}

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('documents.scan.attachTitle')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.md }}>
            {t('documents.scan.hint')}
          </Text>
          <View style={styles.scanActions}>
            <Button label={t('documents.scan.camera')} onPress={() => void handleAdd('camera')} style={styles.flexBtn} />
            <Button
              label={t('documents.scan.gallery')}
              onPress={() => void handleAdd('gallery')}
              variant="secondary"
              style={styles.flexBtn}
            />
          </View>
          <Button label={t('documents.attachFile')} onPress={() => void handleAdd('file')} variant="secondary" />
          {scanBusy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t('documents.scan.reading')}</Text>
            </View>
          ) : null}
          {scanFeedback ? (
            <Text
              style={{
                color: scanFeedback === t('documents.scan.autoFilled') ? colors.success : colors.danger,
                fontSize: 13,
                marginTop: Spacing.sm,
              }}
            >
              {scanFeedback}
            </Text>
          ) : null}
        </Card>

        <LabeledInput label={t('documents.name')} value={name} onChangeText={setName} error={error} />
        <LabeledInput label={t('documents.number')} value={number} onChangeText={setNumber} />
        <Select
          label={t('documents.type')}
          value={typeId}
          options={(types ?? []).map((ty) => ({ id: ty.id, label: ty.name }))}
          onSelect={selectType}
        />
        <LabeledInput
          label={t('documents.scan.newType')}
          value={newTypeName}
          onChangeText={setNewTypeName}
          placeholder={t('documents.scan.newTypeHint')}
        />
        {newTypeName.trim() ? (
          <Text
            style={{ color: colors.primary, fontWeight: '600', marginTop: -12, marginBottom: Spacing.md }}
            onPress={() => void ensureType()}
          >
            + {t('documents.scan.addType')} ({newTypeName.trim()})
          </Text>
        ) : null}
        <DatePickerField label={t('documents.issueDate')} value={issueDate} onChange={setIssueDate} />
        {unlimited ? null : (
          <DatePickerField label={t('documents.expiryDate')} value={expiryDate} onChange={setExpiryDate} />
        )}
        <Checkbox
          label={t('documents.unlimited')}
          value={unlimited}
          onChange={(v) => {
            setUnlimited(v);
            if (v) setExpiryDate('');
          }}
        />
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
      </KeyboardAvoidingView>
    </View>
  );
}

function DocumentFilesSection({
  documentId,
  pending,
  onRemovePending,
}: {
  documentId: string | null;
  pending: DisplayFile[];
  onRemovePending: (id: string) => void;
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  statusRow: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  scanActions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
  filesSection: { marginTop: Spacing.sm, gap: Spacing.sm },
});
