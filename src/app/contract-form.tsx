import { useEffect, useState } from 'react';
import { Alert, InteractionManager, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { FormScrollView, LabeledInput, Select } from '@/components/ui/form';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { DatePickerField } from '@/components/ui/date-picker';
import { ContractFilesSection } from '@/components/contract-files';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
import { AttachSourceRow } from '@/components/attach-source-row';
import { showSavedToast } from '@/components/saved-toast';
import {
  useAddTripFile,
  useContracts,
  useDeleteContract,
  useProfile,
  useRanks,
  useSaveContract,
  useVessels,
} from '@/hooks/queries';
import { ranksForDepartment } from '@/domain/career';
import { expectedSignOff, contractRangesOverlap, contractStatusFor, type DurationInput } from '@/domain/contract';
import { isISODate } from '@/utils/date';
import { importUriFile, isAllowedFileType, pickDocumentFile } from '@/services/file-storage';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { useTheme } from '@/hooks/use-theme';
import { useIsDirty, useUnsavedGuard } from '@/hooks/use-unsaved-guard';
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
  const headerPad = useFloatingHeaderPadding();
  const { data: vessels } = useVessels();
  const { data: ranks } = useRanks();
  const { data: profile } = useProfile();
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
  // The planned sign-off: the contract's end unless the sailor was told another
  // date — then it is moved here, and everything (progress, charts, reminders)
  // follows it. Empty = follow the contract term.
  const [forecast, setForecast] = useState(() => {
    if (!initial || !storedDuration?.mode) return '';
    const term = expectedSignOff(initial.joinDate, {
      mode: storedDuration.mode,
      days: storedDuration.days ?? undefined,
      months: storedDuration.months ?? undefined,
      customEndDate: storedDuration.customEndDate ?? null,
    });
    return term && term !== initial.expectedSignOff ? initial.expectedSignOff : '';
  });
  const [actualSignOff, setActualSignOff] = useState(initial?.actualSignOff ?? '');
  const [monthlyWage, setMonthlyWage] = useState(initial?.monthlyWage != null ? String(initial.monthlyWage) : '');
  const [wageCurrency, setWageCurrency] = useState(initial?.wageCurrency ?? 'USD');
  const [travelDays, setTravelDays] = useState(initial?.travelDays != null ? String(initial.travelDays) : '');
  const [bonus, setBonus] = useState(initial?.bonus != null ? String(initial.bonus) : '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, setPending] = useState<DisplayFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Render the (heavier) attachments section only after the open animation, so
  // editing a contract opens instantly instead of stalling on the transition.
  const [showFiles, setShowFiles] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setShowFiles(true));
    return () => task.cancel();
  }, []);

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
      addTripFile.mutate({
        contractId,
        seaTimeId: null,
        kind: 'contract',
        localPath,
        fileName,
        mimeType: null,
        size: null,
      });
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
  const term = isISODate(joinDate) ? expectedSignOff(joinDate, duration) : null;
  const preview = isISODate(forecast) ? forecast : term;

  const dirty =
    useIsDirty([
      vesselId,
      rankId,
      company,
      joinDate,
      forecast,
      mode,
      days,
      months,
      customEndDate,
      actualSignOff,
      monthlyWage,
      wageCurrency,
      travelDays,
      bonus,
      notes,
    ]) || pending.length > 0;
  const leave = useUnsavedGuard(dirty, () => void submit());

  async function submit() {
    const errs: string[] = [];
    if (!vesselId) errs.push(t('contracts.errors.vesselRequired'));
    if (!rankId) errs.push(t('contracts.errors.rankRequired'));
    if (!isISODate(joinDate)) errs.push(t('contracts.errors.joinRequired'));
    if (!term) errs.push(t('contracts.errors.durationInvalid'));
    if (isISODate(actualSignOff) && isISODate(joinDate) && actualSignOff <= joinDate) {
      errs.push(t('contracts.errors.signOffBeforeJoin'));
    }
    if (preview && isISODate(joinDate) && preview <= joinDate) {
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
          }),
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
          (Date.parse(isISODate(actualSignOff) ? actualSignOff : preview) - Date.parse(joinDate)) / 86_400_000,
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
        bonus: parseFloat(bonus) || null,
        company: company.trim() || null,
        status: contractStatusFor({ joinDate, actualSignOff: isISODate(actualSignOff) ? actualSignOff : null }),
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
      showSavedToast();
      leave();
    } catch (err) {
      if (err instanceof Error && err.message === 'CONTRACT_OVERLAP') {
        setErrors([t('contracts.errors.overlap')]);
      }
    } finally {
      setSaving(false);
    }
  }

  const confirmDelete = () => {
    if (!initial) return;
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove.mutate(initial.id);
          leave();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TelegramHeader
        onBack={() => router.back()}
        actions={[{ icon: 'save-outline', label: t('common.save'), onPress: () => void submit() }]}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FormScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.form, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
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
            // Only the profile department's ladder (plus this contract's own rank, if it differs).
            options={(ranks ?? [])
              .filter((r) => r.id === rankId || ranksForDepartment([r], profile?.department ?? null).length > 0)
              .map((r) => ({ id: r.id, label: r.name }))}
            onSelect={setRankId}
          />
          <LabeledInput label={t('contracts.company')} value={company} onChangeText={setCompany} />
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
            <LabeledInput
              label={t('contracts.modes.days')}
              value={days}
              onChangeText={setDays}
              keyboardType="numeric"
            />
          ) : null}
          {mode === 'months' ? (
            <LabeledInput
              label={t('contracts.modes.months')}
              value={months}
              onChangeText={setMonths}
              keyboardType="numeric"
            />
          ) : null}
          {mode === 'custom_date' ? (
            <DatePickerField label={t('contracts.contractEnd')} value={customEndDate} onChange={setCustomEndDate} />
          ) : null}
          <DatePickerField
            label={t('contracts.expectedSignOff')}
            value={preview ?? ''}
            onChange={(v) => setForecast(v === term ? '' : v)}
          />
          {isISODate(forecast) && term && forecast !== term ? (
            <Text
              style={{ color: colors.primary, fontWeight: '600', marginTop: -8, marginBottom: Spacing.md }}
              onPress={() => setForecast('')}
            >
              {t('contracts.clearPlanned')}
            </Text>
          ) : null}
          <DatePickerField label={t('contracts.actualSignOff')} value={actualSignOff} onChange={setActualSignOff} />
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
          <LabeledInput label={t('contracts.bonus')} value={bonus} onChangeText={setBonus} keyboardType="numeric" />
          <LabeledInput label={t('contracts.notes')} value={notes} onChangeText={setNotes} multiline />
          {contractId ? (
            showFiles ? (
              <ContractFilesSection contractId={contractId} />
            ) : null
          ) : (
            <View style={styles.filesSection}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('tripFiles.contract')}</Text>
              <FileGallery files={pending} onRemove={(id) => setPending((p) => p.filter((f) => f.id !== id))} />
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
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  flexBtn: { flex: 1 },
  filesSection: { marginTop: Spacing.sm, gap: Spacing.sm },
});
