import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { HeaderBar, LabeledInput } from '@/components/ui/form';
import { useSaveVessel, useVessels } from '@/hooks/queries';
import { validateIMO } from '@/database/repositories/vessels-repository';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import type { Vessel } from '@/types/domain';

export default function VesselFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: vessels, isLoading } = useVessels();
  const existing = vessels?.find((v) => v.id === id) ?? null;

  if (id && !existing) {
    return (
      <View style={styles.container}>
        <Text>{isLoading ? '…' : 'Not found'}</Text>
      </View>
    );
  }
  return <VesselForm key={existing?.id ?? 'new'} initial={existing} />;
}

function VesselForm({ initial }: { initial: Vessel | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const save = useSaveVessel();

  const [name, setName] = useState(initial?.name ?? '');
  const [imo, setImo] = useState(initial?.imo ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [flag, setFlag] = useState(initial?.flag ?? '');
  const [gt, setGt] = useState(initial?.grossTonnage?.toString() ?? '');
  const [nt, setNt] = useState(initial?.netTonnage?.toString() ?? '');
  const [owner, setOwner] = useState(initial?.owner ?? '');
  const [management, setManagement] = useState(initial?.managementCompany ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push(t('vessels.errors.nameRequired'));
    if (imo.trim() && !validateIMO(imo.trim())) errs.push(t('vessels.errors.imoInvalid'));
    setErrors(errs);
    if (errs.length > 0) return;
    save.mutate({
      id: initial?.id,
      name: name.trim(),
      imo: imo.trim() || null,
      type: type.trim() || null,
      flag: flag.trim() || null,
      grossTonnage: parseInt(gt, 10) || null,
      netTonnage: parseInt(nt, 10) || null,
      owner: owner.trim() || null,
      managementCompany: management.trim() || null,
      notes: notes.trim() || null,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('vessels.add')} onBack={() => router.back()} />
      <ScrollView nestedScrollEnabled contentContainerStyle={[styles.form, { paddingBottom: Spacing.xxl + insets.bottom }]}>
        <LabeledInput label={t('vessels.name')} value={name} onChangeText={setName} />
        <LabeledInput label={t('vessels.imo')} value={imo} onChangeText={setImo} keyboardType="numeric" placeholder="1234567" />
        <LabeledInput label={t('vessels.type')} value={type} onChangeText={setType} placeholder="Container Ship" />
        <LabeledInput label={t('vessels.flag')} value={flag} onChangeText={setFlag} />
        <LabeledInput label={t('vessels.gt')} value={gt} onChangeText={setGt} keyboardType="numeric" />
        <LabeledInput label={t('vessels.nt')} value={nt} onChangeText={setNt} keyboardType="numeric" />
        <LabeledInput label={t('vessels.owner')} value={owner} onChangeText={setOwner} />
        <LabeledInput label={t('vessels.management')} value={management} onChangeText={setManagement} />
        <LabeledInput label={t('vessels.notes')} value={notes} onChangeText={setNotes} multiline />
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
});
