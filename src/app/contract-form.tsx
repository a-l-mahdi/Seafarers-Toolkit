import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useContracts, useRanks, useSaveContract, useVessels } from '@/hooks/queries';
import { expectedSignOff, type DurationInput } from '@/domain/contract';
import { isISODate } from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
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
  const { data: vessels } = useVessels();
  const { data: ranks } = useRanks();
  const save = useSaveContract();

  const [vesselId, setVesselId] = useState<string | null>(initial?.vesselId ?? null);
  const [rankId, setRankId] = useState<string | null>(initial?.rankId || null);
  const [joinDate, setJoinDate] = useState(initial?.joinDate ?? '');
  const [mode, setMode] = useState<DurationMode>('months');
  const [days, setDays] = useState('180');
  const [months, setMonths] = useState('6');
  const [customEndDate, setCustomEndDate] = useState('');
  const [actualSignOff, setActualSignOff] = useState(initial?.actualSignOff ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const duration: DurationInput = {
    mode,
    days: parseInt(days, 10) || undefined,
    months: parseInt(months, 10) || undefined,
    customEndDate: isISODate(customEndDate) ? customEndDate : null,
  };
  const preview = isISODate(joinDate) ? expectedSignOff(joinDate, duration) : null;

  const submit = () => {
    const errs: string[] = [];
    if (!vesselId) errs.push(t('contracts.errors.vesselRequired'));
    if (!rankId) errs.push(t('contracts.errors.rankRequired'));
    if (!isISODate(joinDate)) errs.push(t('contracts.errors.joinRequired'));
    if (!preview) errs.push(t('contracts.errors.durationInvalid'));
    if (isISODate(actualSignOff) && isISODate(joinDate) && actualSignOff <= joinDate) {
      errs.push(t('contracts.errors.signOffBeforeJoin'));
    }
    setErrors(errs);
    if (errs.length > 0 || !preview) return;
    save.mutate({
      id: initial?.id,
      vesselId: vesselId!,
      rankId: rankId!,
      joinDate,
      expectedSignOff: preview,
      actualSignOff: isISODate(actualSignOff) ? actualSignOff : null,
      durationDays: Math.round((Date.parse(preview) - Date.parse(joinDate)) / 86_400_000),
      status: isISODate(actualSignOff) ? 'completed' : 'active',
      notes: notes.trim() || null,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('contracts.add')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.form}>
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
        <LabeledInput label={t('contracts.notes')} value={notes} onChangeText={setNotes} multiline />
        {errors.map((err, i) => (
          <Text key={i} style={{ color: colors.danger, fontSize: 13 }}>
            {err}
          </Text>
        ))}
        <Button label={t('common.save')} onPress={submit} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  preview: { marginBottom: Spacing.md },
});

