import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui/primitives';
import { FormScrollView, LabeledInput, Select, Checkbox } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCvProfile, useSaveCvProfile } from '@/hooks/queries';
import { exportCv } from '@/services/cv-export';
import { useTheme } from '@/hooks/use-theme';
import { newId } from '@/utils/id';
import { Spacing } from '@/constants/theme';
import type { CvEducation, CvProfile } from '@/types/domain';

export default function CvScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data } = useCvProfile();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('cv.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      {data ? <CvForm initial={data} /> : null}
    </View>
  );
}

function CvForm({ initial }: { initial: CvProfile }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const save = useSaveCvProfile();

  const [cv, setCv] = useState<CvProfile>(() => initial);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const set = <K extends keyof CvProfile>(key: K, value: CvProfile[K]) =>
    setCv((prev) => ({ ...prev, [key]: value }));

  const setEdu = (id: string, patch: Partial<CvEducation>) =>
    set('education', cv.education.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const addEdu = () =>
    set('education', [
      ...cv.education,
      { id: newId(), institution: '', from: null, to: null, qualification: '', location: null },
    ]);
  const removeEdu = (id: string) => set('education', cv.education.filter((e) => e.id !== id));

  const doSave = () => {
    save.mutate(cv, {
      onSuccess: () => {
        setStatus(t('cv.saved'));
        setTimeout(() => setStatus(null), 2000);
      },
    });
  };

  const doExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await save.mutateAsync(cv); // export reads from the DB, so persist edits first
      await exportCv();
    } catch (err) {
      Alert.alert(t('cv.exportFailed'), err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  // Small helper to render a labelled text field bound to a CvProfile string key.
  const textField = (key: keyof CvProfile, labelKey: string, keyboardType?: 'numeric' | 'email-address' | 'phone-pad') => (
    <LabeledInput
      label={t(labelKey)}
      value={(cv[key] as string) ?? ''}
      onChangeText={(v) => set(key, v as CvProfile[typeof key])}
      keyboardType={keyboardType}
    />
  );
  const dateField = (key: keyof CvProfile, labelKey: string) => (
    <DatePickerField
      label={t(labelKey)}
      value={(cv[key] as string | null) ?? ''}
      onChange={(v) => set(key, (v || null) as CvProfile[typeof key])}
    />
  );

  return (
    <FormScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom + 24 }]}
      style={{ backgroundColor: colors.background }}
    >
      <Text style={[styles.note, { color: colors.textMuted }]}>{t('cv.pulledNote')}</Text>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.application')}</Text>
        {textField('positionAppliedFor', 'cv.position')}
        {dateField('dateOfAvailability', 'cv.availableFrom')}
        {textField('addressedTo', 'cv.addressedTo')}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.personal')}</Text>
        {textField('middleName', 'cv.middleName')}
        <Select
          label={t('cv.gender')}
          value={cv.gender || null}
          options={[
            { id: 'male', label: t('cv.male') },
            { id: 'female', label: t('cv.female') },
          ]}
          onSelect={(v) => set('gender', v)}
        />
        {textField('placeOfBirth', 'cv.placeOfBirth')}
        <Select
          label={t('cv.maritalStatus')}
          value={cv.maritalStatus || null}
          options={[
            { id: 'single', label: t('cv.single') },
            { id: 'married', label: t('cv.married') },
            { id: 'other', label: t('cv.other') },
          ]}
          onSelect={(v) => set('maritalStatus', v)}
        />
        {textField('children', 'cv.children', 'numeric')}
        {textField('heightCm', 'cv.height', 'numeric')}
        {textField('weightKg', 'cv.weight', 'numeric')}
        {textField('bloodGroup', 'cv.bloodGroup')}
        {textField('languages', 'cv.languages')}
        {textField('nearestAirport', 'cv.nearestAirport')}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.ids')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('cv.idsNote')}</Text>
        {textField('nationalSeafarerId', 'cv.nationalId')}
        {textField('sidNumber', 'cv.sid')}
        {textField('unionMembership', 'cv.union')}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.education')}</Text>
        {cv.education.map((e) => (
          <View key={e.id} style={[styles.eduItem, { borderColor: colors.border }]}>
            <View style={styles.eduHeader}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('cv.institution')}</Text>
              <Pressable onPress={() => removeEdu(e.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <LabeledInput label={t('cv.institution')} value={e.institution} onChangeText={(v) => setEdu(e.id, { institution: v })} />
            <LabeledInput label={t('cv.qualification')} value={e.qualification} onChangeText={(v) => setEdu(e.id, { qualification: v })} />
            <DatePickerField label={t('cv.from')} value={e.from ?? ''} onChange={(v) => setEdu(e.id, { from: v || null })} />
            <DatePickerField label={t('cv.to')} value={e.to ?? ''} onChange={(v) => setEdu(e.id, { to: v || null })} />
            <LabeledInput label={t('cv.location')} value={e.location ?? ''} onChangeText={(v) => setEdu(e.id, { location: v })} />
          </View>
        ))}
        <Button label={t('cv.addEducation')} variant="secondary" onPress={addEdu} />
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.nok')}</Text>
        {textField('nokName', 'cv.nokName')}
        {textField('nokRelationship', 'cv.nokRelationship')}
        {textField('nokPhone', 'cv.nokPhone', 'phone-pad')}
        {textField('nokAddress', 'cv.nokAddress')}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.bank')}</Text>
        {textField('bankName', 'cv.bankName')}
        {textField('bankAccountHolder', 'cv.accountHolder')}
        {textField('bankAccountNumber', 'cv.accountNumber')}
        {textField('bankBranchCode', 'cv.branchCode')}
        {textField('bankSwift', 'cv.swift')}
        {textField('bankIban', 'cv.iban')}
        {textField('bankAddress', 'cv.bankAddress')}
      </Card>

      <Card>
        <Text style={[styles.section, { color: colors.text }]}>{t('cv.sections.health')}</Text>
        <Checkbox label={t('cv.hMarineAccident')} value={cv.healthMarineAccident} onChange={(v) => set('healthMarineAccident', v)} />
        <Checkbox label={t('cv.hDisability')} value={cv.healthDisability} onChange={(v) => set('healthDisability', v)} />
        <Checkbox label={t('cv.hMedication')} value={cv.healthMedication} onChange={(v) => set('healthMedication', v)} />
        <Checkbox label={t('cv.hDisease')} value={cv.healthDisease} onChange={(v) => set('healthDisease', v)} />
        <Checkbox label={t('cv.hPsychiatric')} value={cv.healthPsychiatric} onChange={(v) => set('healthPsychiatric', v)} />
        <Checkbox label={t('cv.hAddiction')} value={cv.healthAddiction} onChange={(v) => set('healthAddiction', v)} />
        <LabeledInput label={t('cv.healthDetails')} value={cv.healthDetails} onChangeText={(v) => set('healthDetails', v)} multiline />
      </Card>

      {status ? <Text style={[styles.status, { color: colors.success }]}>{status}</Text> : null}

      <View style={styles.actions}>
        <Button label={t('common.save')} variant="secondary" onPress={doSave} style={{ flex: 1 }} />
        <Button label={exporting ? t('cv.exporting') : t('cv.exportPdf')} onPress={() => void doExport()} disabled={exporting} style={{ flex: 1 }} />
      </View>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  note: { fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 12, marginBottom: Spacing.sm },
  section: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  eduItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.md },
  eduHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  status: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
});
