import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FormScrollView, LabeledInput } from '@/components/ui/form';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { showSavedToast } from '@/components/saved-toast';
import { useSaveVessel, useVessels } from '@/hooks/queries';
import { validateIMO } from '@/database/repositories/vessels-repository';
import { useTheme } from '@/hooks/use-theme';
import { useIsDirty, useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import { capturePhoto, pickPhoto, type CropAspect } from '@/services/image-capture';
import { importUriFile, removeImportedFile } from '@/services/file-storage';
import { autoLink, followImo, marineTrafficUrl, vesselFinderUrl } from '@/domain/vessel-links';
import type { Vessel } from '@/types/domain';
import { CountryPickerField } from '@/components/country-picker';
import { resolveCountry } from '@/domain/countries';

/** Vessel photos are cropped landscape: the shape of the contract page's cover. */
const PHOTO_ASPECT: CropAspect = { width: 1600, height: 900 };

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
  const headerPad = useFloatingHeaderPadding();
  const save = useSaveVessel();

  const [name, setName] = useState(initial?.name ?? '');
  const [imo, setImo] = useState(initial?.imo ?? '');
  const [finderLink, setFinderLink] = useState(
    initial?.vesselFinderUrl ?? autoLink(initial?.imo, vesselFinderUrl) ?? '',
  );
  const [trafficLink, setTrafficLink] = useState(
    initial?.marineTrafficUrl ?? autoLink(initial?.imo, marineTrafficUrl) ?? '',
  );
  // The links follow the IMO until the user edits them.
  const changeImo = (next: string) => {
    setFinderLink((cur) => followImo(cur, imo, next, vesselFinderUrl));
    setTrafficLink((cur) => followImo(cur, imo, next, marineTrafficUrl));
    setImo(next);
  };
  const [type, setType] = useState(initial?.type ?? '');
  const [flag, setFlag] = useState(resolveCountry(initial?.flag)?.code ?? initial?.flag ?? '');
  const [gt, setGt] = useState(initial?.grossTonnage?.toString() ?? '');
  const [nt, setNt] = useState(initial?.netTonnage?.toString() ?? '');
  const [owner, setOwner] = useState(initial?.owner ?? '');
  const [management, setManagement] = useState(initial?.managementCompany ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [photo, setPhoto] = useState<string | null>(initial?.photoPath ?? null);
  const [errors, setErrors] = useState<string[]>([]);

  // A picked photo is copied into the app right away (so it shows at once);
  // the vessel's saved photo is only replaced on save.
  const dropUnsavedPhoto = (path: string | null) => {
    if (path && path !== initial?.photoPath) void removeImportedFile(path);
  };
  const choosePhoto = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await capturePhoto(PHOTO_ASPECT) : await pickPhoto(PHOTO_ASPECT);
    if (!uri) return;
    try {
      const localPath = await importUriFile('vessels', uri, `vessel_${Date.now()}.jpg`);
      dropUnsavedPhoto(photo);
      setPhoto(localPath);
    } catch {
      // keep the current photo
    }
  };
  const removePhoto = () => {
    dropUnsavedPhoto(photo);
    setPhoto(null);
  };

  const dirty = useIsDirty([name, imo, finderLink, trafficLink, type, flag, gt, nt, owner, management, notes, photo]);
  const leave = useUnsavedGuard(
    dirty,
    () => void submit(),
    () => dropUnsavedPhoto(photo),
  );

  async function submit() {
    const errs: string[] = [];
    if (!name.trim()) errs.push(t('vessels.errors.nameRequired'));
    if (imo.trim() && !validateIMO(imo.trim())) errs.push(t('vessels.errors.imoInvalid'));
    setErrors(errs);
    if (errs.length > 0) return;
    const photoPath = photo;
    if (initial?.photoPath && photoPath !== initial.photoPath) void removeImportedFile(initial.photoPath);
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
      photoPath,
      vesselFinderUrl: finderLink.trim() || null,
      marineTrafficUrl: trafficLink.trim() || null,
    });
    showSavedToast();
    leave();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TelegramHeader
        title={initial ? initial.name : t('vessels.add')}
        onBack={() => router.back()}
        actions={[{ icon: 'save-outline', label: t('common.save'), onPress: () => void submit() }]}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FormScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.form, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
        >
          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              <View style={styles.photoActions}>
                <PhotoAction icon="camera" onPress={() => void choosePhoto('camera')} />
                <PhotoAction icon="images" onPress={() => void choosePhoto('gallery')} />
                <PhotoAction icon="trash" danger onPress={removePhoto} />
              </View>
            </View>
          ) : (
            <View style={[styles.photoEmpty, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="boat-outline" size={36} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('vessels.photo')}</Text>
              <View style={styles.emptyActions}>
                <Pressable
                  onPress={() => void choosePhoto('camera')}
                  style={({ pressed }) => [
                    styles.emptyBtn,
                    { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('common.camera')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void choosePhoto('gallery')}
                  style={({ pressed }) => [
                    styles.emptyBtn,
                    { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="image-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('common.gallery')}</Text>
                </Pressable>
              </View>
            </View>
          )}
          <LabeledInput label={t('vessels.name')} value={name} onChangeText={setName} />
          <LabeledInput
            label={t('vessels.imo')}
            value={imo}
            onChangeText={changeImo}
            keyboardType="numeric"
            placeholder="1234567"
          />
          <LabeledInput
            label={t('vessels.vesselFinderLink')}
            value={finderLink}
            onChangeText={setFinderLink}
            keyboardType="url"
            ltr
          />
          <LabeledInput
            label={t('vessels.marineTrafficLink')}
            value={trafficLink}
            onChangeText={setTrafficLink}
            keyboardType="url"
            ltr
          />
          <LabeledInput label={t('vessels.type')} value={type} onChangeText={setType} placeholder="Container Ship" />
          <CountryPickerField label={t('vessels.flag')} value={flag} onChange={setFlag} kind="flag" />
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
        </FormScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PhotoAction({
  icon,
  onPress,
  danger,
}: {
  icon: 'camera' | 'images' | 'trash';
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.photoBtn, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={18} color={danger ? '#FF8A7A' : '#FFFFFF'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  photoWrap: {
    width: '100%',
    alignSelf: 'center',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  photoActions: { position: 'absolute', bottom: Spacing.sm, end: Spacing.sm, flexDirection: 'row', gap: Spacing.sm },
  photoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmpty: {
    width: '100%',
    alignSelf: 'center',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
