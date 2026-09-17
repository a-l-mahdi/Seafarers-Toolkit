import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/primitives';
import { FormScrollView, HeaderBar, LabeledInput, Select } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useProfile, useRanks, useSaveProfile } from '@/hooks/queries';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { importUriFile, removeImportedFile } from '@/services/file-storage';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
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
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [stateName, setStateName] = useState(initial?.state ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [zipCode, setZipCode] = useState(initial?.zipCode ?? '');
  const [landline, setLandline] = useState(initial?.landline ?? '');
  const [department, setDepartment] = useState<Department | null>(initial?.department ?? null);
  const [currentRankId, setCurrentRankId] = useState<string | null>(initial?.currentRankId ?? null);
  const [nextRankId, setNextRankId] = useState<string | null>(initial?.nextRankId ?? null);
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.photoPath ?? null);

  const addPhoto = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await capturePhoto() : await pickPhoto();
    if (!uri) return;
    const localPath = await importUriFile('profile', uri, `photo_${Date.now()}.jpg`);
    if (photoPath && photoPath !== localPath) void removeImportedFile(photoPath);
    setPhotoPath(localPath);
  };
  const clearPhoto = () => {
    if (photoPath) void removeImportedFile(photoPath);
    setPhotoPath(null);
  };

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
      address: address.trim() || null,
      city: city.trim() || null,
      state: stateName.trim() || null,
      country: country.trim() || null,
      zipCode: zipCode.trim() || null,
      landline: landline.trim() || null,
      department,
      currentRankId,
      nextRankId,
      photoPath,
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
        <View style={styles.photoRow}>
          {photoPath ? (
            <Image source={{ uri: photoPath }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder, { borderColor: colors.border }]}>
              <Ionicons name="person" size={34} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.photoBtns}>
            <Pressable
              onPress={() => void addPhoto('gallery')}
              style={[styles.photoBtn, { backgroundColor: colors.primaryMuted }]}
            >
              <Ionicons name="image-outline" size={18} color={colors.primary} />
              <Text style={[styles.photoBtnText, { color: colors.primary }]}>{t('profile.photoGallery')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void addPhoto('camera')}
              style={[styles.photoBtn, { backgroundColor: colors.primaryMuted }]}
            >
              <Ionicons name="camera-outline" size={18} color={colors.primary} />
              <Text style={[styles.photoBtnText, { color: colors.primary }]}>{t('profile.photoCamera')}</Text>
            </Pressable>
            {photoPath ? (
              <Pressable onPress={clearPhoto} style={styles.photoBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[styles.photoBtnText, { color: colors.danger }]}>{t('profile.photoRemove')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <LabeledInput label={t('profile.firstName')} value={firstName} onChangeText={setFirstName} />
        <LabeledInput label={t('profile.lastName')} value={lastName} onChangeText={setLastName} />
        <DatePickerField label={t('profile.dateOfBirth')} value={dateOfBirth} onChange={setDateOfBirth} />
        <LabeledInput label={t('profile.nationality')} value={nationality} onChangeText={setNationality} />
        <LabeledInput label={t('profile.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
        <LabeledInput label={t('profile.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <LabeledInput label={t('profile.landline')} value={landline} onChangeText={setLandline} keyboardType="phone-pad" />
        <LabeledInput label={t('profile.seamanBook')} value={seamanBook} onChangeText={setSeamanBook} />
        <LabeledInput label={t('profile.passport')} value={passport} onChangeText={setPassport} />
        <LabeledInput label={t('profile.address')} value={address} onChangeText={setAddress} multiline />
        <LabeledInput label={t('profile.city')} value={city} onChangeText={setCity} />
        <LabeledInput label={t('profile.state')} value={stateName} onChangeText={setStateName} />
        <LabeledInput label={t('profile.country')} value={country} onChangeText={setCountry} />
        <LabeledInput label={t('profile.zipCode')} value={zipCode} onChangeText={setZipCode} />
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
  photoRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
  photo: { width: 84, height: 108, borderRadius: Radius.md },
  photoPlaceholder: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photoBtns: { flex: 1, gap: Spacing.sm },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  photoBtnText: { fontSize: 14, fontWeight: '600' },
});
