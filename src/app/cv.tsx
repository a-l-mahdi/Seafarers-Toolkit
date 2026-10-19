import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { FormScrollView, LabeledInput, Select, Checkbox } from '@/components/ui/form';
import { DatePickerField } from '@/components/ui/date-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useContracts,
  useCvProfile,
  useDocuments,
  useProfile,
  useRanks,
  useSaveCvProfile,
  useVessels,
} from '@/hooks/queries';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { CvPage, CvPreview, fitPageWidth, pagesOf } from '@/components/cv-preview';
import { ZoomViewer } from '@/components/zoom-viewer';
import { buildCvSheet } from '@/services/cv-layout';
import { exportCv, exportCvExcel } from '@/services/cv-export';
import { ExportChoiceModal } from '@/components/export-choice-modal';
import { useTheme } from '@/hooks/use-theme';
import { showSavedToast } from '@/components/saved-toast';
import { newId } from '@/utils/id';
import { Radius, Spacing } from '@/constants/theme';
import { DEFAULT_AVATAR_CV_URI } from '@/constants/default-avatar-cv';
import { CV_MAX_ENTRIES, emptyBankAccount, emptyNextOfKin } from '@/domain/cv';
import type { CvBankAccount, CvEducation, CvNextOfKin, CvProfile, CvSection, Vessel } from '@/types/domain';

export default function CvScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { data } = useCvProfile();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {data ? (
        <CvForm initial={data} onBack={() => router.back()} />
      ) : (
        <TelegramHeader title={t('cv.title')} onBack={() => router.back()} />
      )}
    </View>
  );
}

function CvForm({ initial, onBack }: { initial: CvProfile; onBack: () => void }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const save = useSaveCvProfile();

  const { width } = useWindowDimensions();
  const { data: documents } = useDocuments();
  const { data: profile } = useProfile();
  const { data: contracts } = useContracts();
  const { data: vessels } = useVessels();
  const { data: ranks } = useRanks();
  const [cv, setCv] = useState<CvProfile>(() => initial);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  // The page open in the full-screen zoom viewer.
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [preparing, setPreparing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const dirty = JSON.stringify(cv) !== savedJson;

  useUnsavedGuard(dirty, () => {
    save.mutate(cv);
    return true;
  });

  // The preview is built from the same layout as the PDF and Excel exports,
  // including edits that are not saved yet.
  const vesselsByName = new Map<string, Vessel>();
  for (const v of vessels ?? []) vesselsByName.set(v.name, v);
  const excluded = new Set(cv.excludedDocumentIds);
  const sheet =
    mode === 'preview'
      ? buildCvSheet({
          profile: profile ?? null,
          cv,
          documents: (documents ?? []).filter((d) => !excluded.has(d.id)),
          contracts: contracts ?? [],
          vesselsByName,
          currentRankName: (ranks ?? []).find((r) => r.id === profile?.currentRankId)?.name ?? null,
          // Without a photo of their own, the CV shows the default seafarer portrait.
          hasPhoto: true,
        })
      : null;

  const set = <K extends keyof CvProfile>(key: K, value: CvProfile[K]) => setCv((prev) => ({ ...prev, [key]: value }));

  const setEdu = (id: string, patch: Partial<CvEducation>) =>
    set(
      'education',
      cv.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  const addEdu = () =>
    set('education', [
      ...cv.education,
      { id: newId(), institution: '', from: null, to: null, qualification: '', location: null },
    ]);
  const removeEdu = (id: string) =>
    set(
      'education',
      cv.education.filter((e) => e.id !== id),
    );

  const doSave = () => {
    const snapshot = JSON.stringify(cv);
    save.mutate(cv, {
      onSuccess: () => {
        setSavedJson(snapshot);
        setMode('preview');
        showSavedToast();
      },
    });
  };

  const hidden = new Set(cv.hiddenSections);
  const toggleSection = (section: CvSection, show: boolean) =>
    set('hiddenSections', show ? cv.hiddenSections.filter((s) => s !== section) : [...cv.hiddenSections, section]);

  const setKin = (id: string, patch: Partial<CvNextOfKin>) =>
    set(
      'nextOfKin',
      cv.nextOfKin.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    );
  const addKin = () => set('nextOfKin', [...cv.nextOfKin, emptyNextOfKin()]);
  const removeKin = (id: string) =>
    set(
      'nextOfKin',
      cv.nextOfKin.filter((k) => k.id !== id),
    );
  const setBank = (id: string, patch: Partial<CvBankAccount>) =>
    set(
      'bankAccounts',
      cv.bankAccounts.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  const addBank = () => set('bankAccounts', [...cv.bankAccounts, emptyBankAccount()]);
  const removeBank = (id: string) =>
    set(
      'bankAccounts',
      cv.bankAccounts.filter((b) => b.id !== id),
    );

  const toggleDoc = (id: string, include: boolean) => {
    const next = new Set(cv.excludedDocumentIds);
    if (include) next.delete(id);
    else next.add(id);
    set('excludedDocumentIds', Array.from(next));
  };

  const openExport = async () => {
    setPreparing(true);
    try {
      await save.mutateAsync(cv); // export reads from the DB, so persist edits first
      setSavedJson(JSON.stringify(cv));
      setExportOpen(true);
    } catch (err) {
      Alert.alert(t('cv.exportFailed'), err instanceof Error ? err.message : String(err));
    } finally {
      setPreparing(false);
    }
  };

  // Small helper to render a labelled text field bound to a CvProfile string key.
  const textField = (
    key: keyof CvProfile,
    labelKey: string,
    keyboardType?: 'numeric' | 'email-address' | 'phone-pad',
  ) => (
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
    <>
      <TelegramHeader
        title={t('cv.title')}
        onBack={mode === 'edit' ? () => setMode('preview') : onBack}
        actions={
          mode === 'edit'
            ? [{ icon: 'save-outline', label: t('common.save'), onPress: doSave }]
            : [{ icon: 'create-outline', label: t('common.edit'), onPress: () => setMode('edit') }]
        }
      />
      {mode === 'preview' && sheet ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{
            paddingTop: headerPad,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.xxl + insets.bottom + 72,
          }}
          showsVerticalScrollIndicator={false}
        >
          <CvPreview
            sheet={sheet}
            width={width - Spacing.lg * 2}
            photoUri={profile?.photoPath ?? DEFAULT_AVATAR_CV_URI}
            onPagePress={setZoomPage}
          />
        </ScrollView>
      ) : (
        <FormScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.container,
            { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom + 24 },
          ]}
          style={{ backgroundColor: colors.background }}
        >
          <Text style={[styles.note, { color: colors.textMuted }]}>{t('cv.pulledNote')}</Text>

          <SectionCard
            title={t('cv.sections.application')}
            shown={!hidden.has('application')}
            onShownChange={(v) => toggleSection('application', v)}
          >
            {textField('positionAppliedFor', 'cv.position')}
            {dateField('dateOfAvailability', 'cv.availableFrom')}
            {textField('addressedTo', 'cv.addressedTo')}
          </SectionCard>

          <SectionCard
            title={t('cv.sections.personal')}
            shown={!hidden.has('personal')}
            onShownChange={(v) => toggleSection('personal', v)}
          >
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
          </SectionCard>

          <SectionCard
            title={t('cv.sections.ids')}
            shown={!hidden.has('ids')}
            onShownChange={(v) => toggleSection('ids', v)}
          >
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('cv.idsNote')}</Text>
            {textField('nationalSeafarerId', 'cv.nationalId')}
            {textField('sidNumber', 'cv.sid')}
            {textField('unionMembership', 'cv.union')}
          </SectionCard>

          <SectionCard
            title={t('cv.sections.documents')}
            shown={!hidden.has('documents')}
            onShownChange={(v) => toggleSection('documents', v)}
          >
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t('cv.documentsNote')}</Text>
            {(documents ?? []).length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('cv.noDocuments')}</Text>
            ) : (
              (documents ?? []).map((d) => (
                <Checkbox
                  key={d.id}
                  label={d.name || d.typeName || '—'}
                  value={!cv.excludedDocumentIds.includes(d.id)}
                  onChange={(inc) => toggleDoc(d.id, inc)}
                />
              ))
            )}
          </SectionCard>

          <SectionCard
            title={t('cv.sections.education')}
            shown={!hidden.has('education')}
            onShownChange={(v) => toggleSection('education', v)}
          >
            {cv.education.map((e) => (
              <View key={e.id} style={[styles.eduItem, { borderColor: colors.border }]}>
                <View style={styles.eduHeader}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('cv.institution')}</Text>
                  <Pressable onPress={() => removeEdu(e.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <LabeledInput
                  label={t('cv.institution')}
                  value={e.institution}
                  onChangeText={(v) => setEdu(e.id, { institution: v })}
                />
                <LabeledInput
                  label={t('cv.qualification')}
                  value={e.qualification}
                  onChangeText={(v) => setEdu(e.id, { qualification: v })}
                />
                <DatePickerField
                  label={t('cv.from')}
                  value={e.from ?? ''}
                  onChange={(v) => setEdu(e.id, { from: v || null })}
                />
                <DatePickerField
                  label={t('cv.to')}
                  value={e.to ?? ''}
                  onChange={(v) => setEdu(e.id, { to: v || null })}
                />
                <LabeledInput
                  label={t('cv.location')}
                  value={e.location ?? ''}
                  onChangeText={(v) => setEdu(e.id, { location: v })}
                />
              </View>
            ))}
            <Button label={t('cv.addEducation')} variant="secondary" onPress={addEdu} />
          </SectionCard>

          <SectionCard
            title={t('cv.sections.nok')}
            shown={!hidden.has('nok')}
            onShownChange={(v) => toggleSection('nok', v)}
          >
            {cv.nextOfKin.map((k, i) => (
              <EntryBox
                key={k.id}
                title={cv.nextOfKin.length > 1 ? `${t('cv.sections.nok')} ${i + 1}` : null}
                onRemove={cv.nextOfKin.length > 1 ? () => removeKin(k.id) : undefined}
              >
                <LabeledInput label={t('cv.nokName')} value={k.name} onChangeText={(v) => setKin(k.id, { name: v })} />
                <LabeledInput
                  label={t('cv.nokRelationship')}
                  value={k.relationship}
                  onChangeText={(v) => setKin(k.id, { relationship: v })}
                />
                <LabeledInput
                  label={t('cv.nokPhone')}
                  value={k.phone}
                  onChangeText={(v) => setKin(k.id, { phone: v })}
                  keyboardType="phone-pad"
                />
                <LabeledInput
                  label={t('cv.nokAddress')}
                  value={k.address}
                  onChangeText={(v) => setKin(k.id, { address: v })}
                />
              </EntryBox>
            ))}
            {cv.nextOfKin.length < CV_MAX_ENTRIES ? (
              <Button label={t('cv.addNok')} variant="secondary" onPress={addKin} />
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('cv.sections.bank')}
            shown={!hidden.has('bank')}
            onShownChange={(v) => toggleSection('bank', v)}
          >
            {cv.bankAccounts.map((b, i) => (
              <EntryBox
                key={b.id}
                title={cv.bankAccounts.length > 1 ? `${t('cv.account')} ${i + 1}` : null}
                onRemove={cv.bankAccounts.length > 1 ? () => removeBank(b.id) : undefined}
              >
                <LabeledInput
                  label={t('cv.bankName')}
                  value={b.bankName}
                  onChangeText={(v) => setBank(b.id, { bankName: v })}
                />
                <LabeledInput
                  label={t('cv.accountHolder')}
                  value={b.accountHolder}
                  onChangeText={(v) => setBank(b.id, { accountHolder: v })}
                />
                <LabeledInput
                  label={t('cv.accountNumber')}
                  value={b.accountNumber}
                  onChangeText={(v) => setBank(b.id, { accountNumber: v })}
                />
                <LabeledInput
                  label={t('cv.branchCode')}
                  value={b.branchCode}
                  onChangeText={(v) => setBank(b.id, { branchCode: v })}
                />
                <LabeledInput label={t('cv.swift')} value={b.swift} onChangeText={(v) => setBank(b.id, { swift: v })} />
                <LabeledInput label={t('cv.iban')} value={b.iban} onChangeText={(v) => setBank(b.id, { iban: v })} />
                <LabeledInput
                  label={t('cv.bankAddress')}
                  value={b.bankAddress}
                  onChangeText={(v) => setBank(b.id, { bankAddress: v })}
                />
              </EntryBox>
            ))}
            {cv.bankAccounts.length < CV_MAX_ENTRIES ? (
              <Button label={t('cv.addBank')} variant="secondary" onPress={addBank} />
            ) : null}
          </SectionCard>

          <SectionCard
            title={t('cv.sections.health')}
            shown={!hidden.has('health')}
            onShownChange={(v) => toggleSection('health', v)}
          >
            <Checkbox
              label={t('cv.hMarineAccident')}
              value={cv.healthMarineAccident}
              onChange={(v) => set('healthMarineAccident', v)}
            />
            <Checkbox
              label={t('cv.hDisability')}
              value={cv.healthDisability}
              onChange={(v) => set('healthDisability', v)}
            />
            <Checkbox
              label={t('cv.hMedication')}
              value={cv.healthMedication}
              onChange={(v) => set('healthMedication', v)}
            />
            <Checkbox label={t('cv.hDisease')} value={cv.healthDisease} onChange={(v) => set('healthDisease', v)} />
            <Checkbox
              label={t('cv.hPsychiatric')}
              value={cv.healthPsychiatric}
              onChange={(v) => set('healthPsychiatric', v)}
            />
            <Checkbox
              label={t('cv.hAddiction')}
              value={cv.healthAddiction}
              onChange={(v) => set('healthAddiction', v)}
            />
            <LabeledInput
              label={t('cv.healthDetails')}
              value={cv.healthDetails}
              onChangeText={(v) => set('healthDetails', v)}
              multiline
            />
          </SectionCard>
        </FormScrollView>
      )}
      {mode === 'preview' ? (
        <View style={[styles.bar, { bottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={() => setMode('edit')}
            style={({ pressed }) => [
              styles.barBtn,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.barText, { color: colors.primary }]}>{t('common.edit')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void openExport()}
            disabled={preparing}
            style={({ pressed }) => [
              styles.barBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                opacity: preparing ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="share-outline" size={18} color={colors.onPrimary} />
            <Text style={[styles.barText, { color: colors.onPrimary }]}>
              {preparing ? t('cv.exporting') : t('cv.export')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {exportOpen ? (
        <ExportChoiceModal
          visible
          title={t('cv.exportTitle')}
          onClose={() => setExportOpen(false)}
          formats={[
            { key: 'pdf', label: 'PDF', icon: 'document-text', generate: exportCv },
            { key: 'excel', label: 'Excel', icon: 'grid', generate: exportCvExcel },
          ]}
        />
      ) : null}
      {zoomPage !== null && sheet ? (
        <ZoomViewer
          items={pagesOf(sheet)}
          initialIndex={zoomPage}
          keyOf={(_, i) => String(i)}
          renderItem={(rows, box) => (
            <CvPage
              sheet={sheet}
              rows={rows}
              first={rows[0] === sheet.rows[0]}
              width={fitPageWidth(box.width, box.height)}
              photoUri={profile?.photoPath ?? DEFAULT_AVATAR_CV_URI}
            />
          )}
          title={(i) => `${t('cv.title')} · ${i + 1}`}
          onClose={() => setZoomPage(null)}
        />
      ) : null}
    </>
  );
}

/** A form card with a tick at its title: ticked = the section appears in the CV. */
function SectionCard({
  title,
  shown,
  onShownChange,
  children,
}: {
  title: string;
  shown: boolean;
  onShownChange: (shown: boolean) => void;
  children: ReactNode;
}) {
  const colors = useTheme();
  return (
    <Card>
      <Pressable
        onPress={() => onShownChange(!shown)}
        accessibilityRole="checkbox"
        accessibilityLabel={title}
        accessibilityState={{ checked: shown }}
        hitSlop={6}
        style={styles.sectionHead}
      >
        <Text style={[styles.section, styles.sectionTitle, { color: shown ? colors.text : colors.textMuted }]}>
          {title}
        </Text>
        <View
          style={[
            styles.tick,
            shown
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {shown ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </View>
      </Pressable>
      {shown ? <View style={styles.sectionBody}>{children}</View> : null}
    </Card>
  );
}

/** One entry of a list (a next of kin, a bank account), with its number and a remove button. */
function EntryBox({ title, onRemove, children }: { title: string | null; onRemove?: () => void; children: ReactNode }) {
  const colors = useTheme();
  if (!title && !onRemove) return <>{children}</>;
  return (
    <View style={[styles.eduItem, { borderColor: colors.border }]}>
      <View style={styles.eduHeader}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{title}</Text>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={title ?? ''}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  note: { fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 12, marginBottom: Spacing.sm },
  section: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionTitle: { flex: 1, marginBottom: 0 },
  sectionBody: { marginTop: Spacing.md },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduItem: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.md },
  eduHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  bar: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', gap: Spacing.sm },
  barBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#0B2340',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  barText: { fontSize: 15, fontWeight: '700' },
});
