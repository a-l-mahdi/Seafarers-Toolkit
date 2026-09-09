import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, FieldRow } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useCreateDocumentType, useDocumentTypes, useSaveDocument, useAddDocumentFile } from '@/hooks/queries';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { parseDocumentText } from '@/services/ocr';
import { importPickedFile } from '@/services/file-storage';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

export default function DocumentScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: types } = useDocumentTypes();
  const createType = useCreateDocumentType();
  const save = useSaveDocument();
  const addFile = useAddDocumentFile();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');

  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const processImage = async (uri: string) => {
    setImageUri(uri);
    setBusy(true);
    setError(null);
    try {
      // On-device OCR — no internet involved.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
      const result = await TextRecognition.recognize(uri);
      const parsed = parseDocumentText(result?.text ?? '');
      if (parsed.documentNumber) setNumber(parsed.documentNumber);
      if (parsed.issueDate) setIssueDate(parsed.issueDate);
      if (parsed.expiryDate) setExpiryDate(parsed.expiryDate);
      if (!parsed.documentNumber && !parsed.issueDate && !parsed.expiryDate) {
        setError(t('documents.scan.nothingFound'));
      }
    } catch {
      setError(t('documents.scan.failed'));
    } finally {
      setBusy(false);
    }
  };

  const scanWithCamera = async () => {
    const uri = await capturePhoto();
    if (uri) void processImage(uri);
  };

  const scanFromLibrary = async () => {
    const uri = await pickPhoto();
    if (uri) void processImage(uri);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t('documents.errors.nameRequired'));
      return;
    }
    const saved = save.mutateAsync({
      name: name.trim(),
      number: number.trim() || null,
      typeId,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      issuingAuthority: null,
      issuingCountry: null,
      warningThresholdDays: 210,
      validThresholdDays: 180,
      notes: null,
    });
    const doc = await saved;
    if (imageUri) {
      try {
        const localPath = await importPickedFile(doc.id, {
          uri: imageUri,
          name: `scan_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: null,
        });
        addFile.mutate({
          documentId: doc.id,
          localPath,
          fileName: `scan_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          size: null,
        });
      } catch {
        // file copy is best-effort
      }
    }
    router.back();
  };

  const ensureType = async () => {
    const typeName = newTypeName.trim();
    if (!typeName) return;
    const created = await createType.mutateAsync(typeName);
    setTypeId(created.id);
    setNewTypeName('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('documents.scan.title')} onBack={() => router.back()} />
      <ScrollView nestedScrollEnabled contentContainerStyle={[styles.form, { paddingBottom: Spacing.xxl + insets.bottom }]}>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: Spacing.md }}>
            {t('documents.scan.hint')}
          </Text>
          <View style={styles.actions}>
            <Button label={t('documents.scan.camera')} onPress={() => void scanWithCamera()} style={styles.flexBtn} />
            <Button
              label={t('documents.scan.gallery')}
              onPress={() => void scanFromLibrary()}
              variant="secondary"
              style={styles.flexBtn}
            />
          </View>
          {imageUri ? (
            <FieldRow label={t('documents.scan.image')} value={t('common.ok')} />
          ) : null}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t('documents.scan.reading')}</Text>
            </View>
          ) : null}
          {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('documents.scan.review')}</Text>
          <Select
            label={t('documents.type')}
            value={typeId}
            options={(types ?? []).map((ty) => ({ id: ty.id, label: ty.name }))}
            onSelect={setTypeId}
          />
          <LabeledInput
            label={t('documents.scan.newType')}
            value={newTypeName}
            onChangeText={setNewTypeName}
            placeholder={t('documents.scan.newTypeHint')}
          />
          {newTypeName.trim() ? (
            <Text style={{ color: colors.primary, fontWeight: '600', marginTop: -12, marginBottom: Spacing.md }} onPress={() => void ensureType()}>
              + {t('documents.scan.addType')} ({newTypeName.trim()})
            </Text>
          ) : null}
          <LabeledInput label={t('documents.name')} value={name} onChangeText={setName} error={error} />
          <LabeledInput label={t('documents.number')} value={number} onChangeText={setNumber} />
          <DatePickerField label={t('documents.issueDate')} value={issueDate} onChange={setIssueDate} />
          <DatePickerField label={t('documents.expiryDate')} value={expiryDate} onChange={setExpiryDate} />
        </Card>

        <Button label={t('common.save')} onPress={() => void submit()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  flexBtn: { flex: 1 },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
});
