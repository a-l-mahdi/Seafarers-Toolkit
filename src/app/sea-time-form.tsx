import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { useProfile, useRanks, useSaveSeaTimeRecord } from '@/hooks/queries';
import { isISODate } from '@/utils/date';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function SeaTimeFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const { data: ranks } = useRanks();
  const { data: profile } = useProfile();
  const save = useSaveSeaTimeRecord();

  const [rankId, setRankId] = useState<string | null>(profile?.currentRankId ?? null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [days, setDays] = useState('');
  const [hours, setHours] = useState('');
  const [verified, setVerified] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    const parsedDays = parseInt(days, 10);
    const parsedHours = parseInt(hours, 10) || 0;
    const hasDates = isISODate(fromDate) && isISODate(toDate);
    if (hasDates && toDate <= fromDate) errs.push(t('seaTime.errors.rangeInvalid'));
    if ((Number.isNaN(parsedDays) || parsedDays <= 0) && parsedHours <= 0) {
      errs.push(t('seaTime.errors.positive'));
    }
    setErrors(errs);
    if (errs.length > 0) return;

    save.mutate({
      contractId: null,
      rankId,
      source: 'manual',
      fromDate: hasDates ? fromDate : null,
      toDate: hasDates ? toDate : null,
      days: Number.isNaN(parsedDays) ? 0 : parsedDays,
      hours: parsedHours,
      verified,
      notes: notes.trim() || null,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('seaTime.addManual')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.form}>
        <Select
          label={t('seaTime.rank')}
          value={rankId}
          options={(ranks ?? []).map((r) => ({ id: r.id, label: r.name }))}
          onSelect={setRankId}
        />
        <LabeledInput
          label={`${t('seaTime.fromDate')} (YYYY-MM-DD)`}
          value={fromDate}
          onChangeText={setFromDate}
          placeholder="2020-01-01"
        />
        <LabeledInput
          label={`${t('seaTime.toDate')} (YYYY-MM-DD)`}
          value={toDate}
          onChangeText={setToDate}
          placeholder="2021-01-01"
        />
        <LabeledInput label={t('seaTime.days')} value={days} onChangeText={setDays} keyboardType="numeric" />
        <LabeledInput label={t('seaTime.hours')} value={hours} onChangeText={setHours} keyboardType="numeric" />
        <View style={styles.checkRow}>
          <Text style={{ color: colors.text }} onPress={() => setVerified(!verified)}>
            {verified ? '☑' : '☐'} {t('seaTime.verified')}
          </Text>
        </View>
        <LabeledInput label={t('seaTime.notes')} value={notes} onChangeText={setNotes} multiline />
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
  checkRow: { marginBottom: Spacing.md },
});
