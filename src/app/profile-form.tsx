import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { FormScrollView, HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useProfile, useRanks, useSaveProfile } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import type { Department, Profile } from '@/types/domain';

export default function ProfileFormScreen() {
  const { data: profile, isLoading } = useProfile();
  if (!profile && isLoading) {
    return <View style={styles.container} />;
  }
  return <ProfileForm key={profile?.id ?? 'new'} initial={profile ?? null} />;
}

function ProfileForm({ initial }: { initial: Profile | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: ranks } = useRanks();
  const save = useSaveProfile();

  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '');
  const [nationality, setNationality] = useState(initial?.nationality ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [seamanBook, setSeamanBook] = useState(initial?.seamanBookNumber ?? '');
  const [passport, setPassport] = useState(initial?.passportNumber ?? '');
  const [department, setDepartment] = useState<Department | null>(initial?.department ?? null);
  const [currentRankId, setCurrentRankId] = useState<string | null>(initial?.currentRankId ?? null);
  const [nextRankId, setNextRankId] = useState<string | null>(initial?.nextRankId ?? null);

  const submit = () => {
    save.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth || null,
      nationality: nationality.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      seamanBookNumber: seamanBook.trim() || null,
      passportNumber: passport.trim() || null,
      department,
      currentRankId,
      nextRankId,
      photoPath: initial?.photoPath ?? null,
    });
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('profile.title')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FormScrollView
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.form, { paddingBottom: Spacing.xxl + insets.bottom }]}
        >
        <LabeledInput label={t('profile.firstName')} value={firstName} onChangeText={setFirstName} />
        <LabeledInput label={t('profile.lastName')} value={lastName} onChangeText={setLastName} />
        <DatePickerField label={t('profile.dateOfBirth')} value={dateOfBirth} onChange={setDateOfBirth} />
        <LabeledInput label={t('profile.nationality')} value={nationality} onChangeText={setNationality} />
        <LabeledInput label={t('profile.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
        <LabeledInput label={t('profile.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <LabeledInput label={t('profile.seamanBook')} value={seamanBook} onChangeText={setSeamanBook} />
        <LabeledInput label={t('profile.passport')} value={passport} onChangeText={setPassport} />
        <Select
          label={t('profile.department')}
          value={department}
          options={[
            { id: 'deck', label: t('profile.departments.deck') },
            { id: 'engine', label: t('profile.departments.engine') },
            { id: 'electro', label: t('profile.departments.electro') },
            { id: 'deck_rating', label: t('profile.departments.deck_rating') },
            { id: 'engine_rating', label: t('profile.departments.engine_rating') },
            { id: 'catering', label: t('profile.departments.catering') },
          ]}
          onSelect={(v) => setDepartment(v as Department)}
        />
        <Select
          label={t('profile.currentRank')}
          value={currentRankId}
          options={(ranks ?? []).map((r) => ({ id: r.id, label: r.name }))}
          onSelect={setCurrentRankId}
        />
        <Select
          label={t('profile.nextRank')}
          value={nextRankId}
          options={(ranks ?? []).map((r) => ({ id: r.id, label: r.name }))}
          onSelect={setNextRankId}
        />
        <Button label={t('common.save')} onPress={submit} />
        </FormScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
});
