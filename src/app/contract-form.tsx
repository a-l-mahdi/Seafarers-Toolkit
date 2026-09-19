import { useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { FormScrollView, HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { ContractFilesSection } from '@/components/contract-files';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import { AttachSourceRow } from '@/components/attach-source-row';
import { useAddTripFile, useContracts, useDeleteContract, useRanks, useSaveContract, useVessels } from '@/hooks/queries';
import { expectedSignOff, contractRangesOverlap, type DurationInput } from '@/domain/contract';
import { isISODate } from '@/utils/date';
import { importUriFile, isAllowedFileType, pickDocumentFile } from '@/services/file-storage';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import type { ContractListRow } from '@/hooks/queries';
import type { DurationMode } from '@/types/domain';

export default function ContractFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: contracts, isLoading } = useContracts();
  const existing = contracts?.find((c) => c.id === id) ?? null;

  if (id && !existing) {
    return (
      <View style={styles.container}>
        <Text>{isLoading ? '…' : 'Not found'}</Text>
      </View>
    );
  }
  return <ContractForm key={existing?.id ?? 'new'} initial={existing} />;
}

function ContractForm({ initial }: { initial: ContractListRow | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: vessels } = useVessels();
  const { data: ranks } = useRanks();
  const { data: contracts } = useContracts();
  const save = useSaveContract();
  const remove = useDeleteContract();
  const addTripFile = useAddTripFile();

  const contractId = initial?.id ?? null;

  // Restore the exact stored duration when editing; without it the form would
  // recompute the sign-off date from defaults and ignore duration changes.
  const storedDuration: Partial<DurationInput> | null = (() => {
    if (initial?.durationJson) {
      try {
        return JSON.parse(initial.durationJson) as Partial<DurationInput>;
      } catch {
        // fall through to legacy fallback
      }
    }
    return initial ? { mode: 'custom_date', customEndDate: initial.expectedSignOff } : null;
  })();

  const [vesselId, setVesselId] = useState<string | null>(initial?.vesselId ?? null);
  const [rankId, setRankId] = useState<string | null>(initial?.rankId || null);
  const [joinDate, setJoinDate] = useState(initial?.joinDate ?? '');
  const [mode, setMode] = useState<DurationMode>(storedDuration?.mode ?? 'months');
  const [days, setDays] = useState(String(storedDuration?.days ?? 120));
  const [months, setMonths] = useState(String(storedDuration?.months ?? 4));
  const [customEndDate, setCustomEndDate] = useState(storedDuration?.customEndDate ?? '');
  const [actualSignOff, setActualSignOff] = useState(initial?.actualSignOff ?? '');
  const [monthlyWage, setMonthlyWage] = useState(
    initial?.monthlyWage != null ? String(initial.monthlyWage) : ''
  );
  const [wageCurrency, setWageCurrency] = useState(initial?.wageCurrency ?? 'USD');
  const [travelDays, setTravelDays] = useState(
    initial?.travelDays != null ? String(initial.travelDays) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, setPending] = useState<DisplayFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (source: 'camera' | 'gallery' | 'file') => {
    let uri: string | null = null;
    let fileName: string;
    if (source === 'camera') {
      uri = await capturePhoto();
      fileName = `contract_${Date.now()}.jpg`;
    } else if (source === 'gallery') {
      uri = await pickPhoto();
      fileName = `contract_${Date.now()}.jpg`;
    } else {
      const picked = await pickDocumentFile();
      if (!picked) return;
      if (!isAllowedFileType(picked.mimeType, picked.name)) return;
      uri = picked.uri;
      fileName = picked.name;
    }
    if (!uri) return;
    if (contractId) {
      const localPath = await importUriFile(`trips/${contractId}`, uri, fileName);
      addTripFile.mutate({ contractId, seaTimeId: null, kind: 'contract', localPath, fileName, mimeType: null, size: null });
    } else {
      setPending((p) => [...p, { id: uri, uri, name: fileName }]);
    }
  };

  const duration: DurationInput = {
    mode,
    days: parseInt(days, 10) || undefined,
    months: parseInt(months, 10) || undefined,
    customEndDate: isISODate(customEndDate) ? customEndDate : null,
  };
  const preview = isISODate(joinDate) ? expectedSignOff(joinDate, duration) : null;

  const submit = async () => {
    const errs: string[] = [];
    if (!vesselId) errs.push(t('contracts.errors.vesselRequired'));
    if (!rankId) errs.push(t('contracts.errors.rankRequired'));
    if (!isISODate(joinDate)) errs.push(t('contracts.errors.joinRequired'));
    if (!preview) errs.push(t('contracts.errors.durationInvalid'));
    if (isISODate(actualSignOff) && isISODate(joinDate) && actualSignOff <= joinDate) {
      errs.push(t('contracts.errors.signOffBeforeJoin'));
    }
    // A sailor cannot be on two vessels at once. The overlap check uses the
    // EFFECTIVE end date: the actual sign-off (real trip end) when entered,
    // otherwise the expected sign-off. A sailor may rejoin while leave from
    // the previous contract is still running — only onboard time overlaps.
    if (
      preview &&
      (contracts ?? []).some(
        (c) =>
          c.id !== initial?.id &&
          contractRangesOverlap(c, {
            joinDate,
            expectedSignOff: preview,
            actualSignOff: isISODate(actualSignOff) ? actualSignOff : null,
          })
      )
    ) {
      errs.push(t('contracts.errors.overlap'));
    }
    setErrors(errs);
    if (errs.length > 0 || !preview) return;
    setSaving(true);
    try {
      const contract = await save.mutateAsync({
        id: initial?.id,
        vesselId: vesselId!,
        rankId: rankId!,
        joinDate,
        expectedSignOff: preview,
        actualSignOff: isISODate(actualSignOff) ? actualSignOff : null,
        // Trip length counts to the real (actual) sign-off when provided.
        durationDays: Math.round(
          (Date.parse(isISODate(actualSignOff) ? actualSignOff : preview) - Date.parse(joinDate)) / 86_400_000
        ),
        durationJson: JSON.stringify({
          mode,
          days: duration.days ?? null,
          months: duration.months ?? null,
          customEndDate: duration.customEndDate ?? null,
        }),
        monthlyWage: parseFloat(monthlyWage) || null,
        wageCurrency: wageCurrency.trim() || null,
        travelDays: parseInt(travelDays, 10) || null,
        status: isISODate(actualSignOff) ? 'completed' : 'active',
        notes: notes.trim() || null,
      });
      // Import pending contract scans now that the contract id exists.
      for (const file of pending) {
        try {
          const localPath = await importUriFile(`trips/${contract.id}`, file.uri, file.name);
          addTripFile.mutate({
            contractId: contract.id,
            seaTimeId: null,
            kind: 'contract',
            localPath,
            fileName: file.name,
            mimeType: null,
            size: null,
          });
        } catch {
          // per-file copy is best-effort
        }
      }
      router.back();
    } catch (err) {
      if (err instanceof Error && err.message === 'CONTRACT_OVERLAP') {
        setErrors([t('contracts.errors.overlap')]);
      }
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
        title={initial ? t('common.edit') : t('contracts.add')}
        onBack={() => router.back()}
        action={initial ? { label: t('common.delete'), onPress: confirmDelete } : undefined}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <FormScrollView
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.form, { paddingBottom: Spacing.xxl + insets.bottom }]}
        >
        <Select
          label={t('contracts.vessel')}
          value={vesselId}
          options={(vessels ?? []).map((v) => ({ id: v.id, label: v.name }))}
          onSelect={setVesselId}
        />
        <Select
          label={t('contracts.rank')}
          value={rankId}
          options={(ranks ?? []).map((r) => ({ id: r.id, label: r.name }))}
          onSelect={setRankId}
        />
        <DatePickerField label={t('contracts.joinDate')} value={joinDate} onChange={setJoinDate} />
        <Select
          label={t('contracts.duration')}
          value={mode}
          options={[
            { id: 'months', label: t('contracts.modes.months') },
            { id: 'days', label: t('contracts.modes.days') },
            { id: 'custom_date', label: t('contracts.modes.custom_date') },
          ]}
          onSelect={(v) => setMode(v as DurationMode)}
        />
        {mode === 'days' ? (
          <LabeledInput label={t('contracts.modes.days')} value={days} onChangeText={setDays} keyboardType="numeric" />
        ) : null}
        {mode === 'months' ? (
          <LabeledInput label={t('contracts.modes.months')} value={months} onChangeText={setMonths} keyboardType="numeric" />
        ) : null}
        {mode === 'custom_date' ? (
          <DatePickerField
            label={t('contracts.expectedSignOff')}
            value={customEndDate}
            onChange={setCustomEndDate}
          />
        ) : null}
        {preview ? (
          <View style={styles.preview}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('contracts.expectedSignOff')}</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{preview}</Text>
          </View>
        ) : null}
        <DatePickerField
          label={t('contracts.actualSignOff')}
          value={actualSignOff}
          onChange={setActualSignOff}
        />
        <LabeledInput
          label={t('contracts.monthlyWage')}
          value={monthlyWage}
          onChangeText={setMonthlyWage}
          keyboardType="numeric"
        />
        <LabeledInput
          label={t('contracts.currency')}
          value={wageCurrency}
          onChangeText={setWageCurrency}
          placeholder="USD"
        />
        <LabeledInput
          label={t('contracts.travelDays')}
          value={travelDays}
          onChangeText={setTravelDays}
          keyboardType="numeric"
        />
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -Spacing.sm, marginBottom: Spacing.md }}>
          {t('contracts.travelDaysHint')}
        </Text>
        <LabeledInput label={t('contracts.notes')} value={notes} onChangeText={setNotes} multiline />
        {contractId ? (
          <ContractFilesSection contractId={contractId} />
        ) : (
          <View style={styles.filesSection}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('tripFiles.contract')}</Text>
            <FileGallery
              files={pending}
              onRemove={(id) => setPending((p) => p.filter((f) => f.id !== id))}
            />
            <AttachSourceRow onPick={(s) => void handleAdd(s)} />
          </View>
        )}
        {errors.map((err, i) => (
          <Text key={i} style={{ color: colors.danger, fontSize: 13 }}>
            {err}
          </Text>
        ))}
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
        </FormScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  preview: { marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
  filesSection: { marginTop: Spacing.sm, gap: Spacing.sm },
});
