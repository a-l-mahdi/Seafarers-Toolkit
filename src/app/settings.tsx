import { useState } from 'react';
import { I18nManager, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, ProgressBar } from '@/components/ui/primitives';
import { LabeledInput, Select } from '@/components/ui/form';
import { useLeaveSettings, useSaveLeaveSettings } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings-store';
import { changeLocale, isRTL } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import * as Updates from 'expo-updates';
import { createBackup, pickBackupFile, restoreBackup, type ProgressFn } from '@/services/backup';
import type { LeaveSettings } from '@/types/domain';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { locale, theme, calendar, setLocale, setTheme, setCalendar } = useSettingsStore();

  const applyLocale = async (next: 'en' | 'fa') => {
    setLocale(next);
    await changeLocale(next);
    const needsRestart = isRTL(next) !== I18nManager.isRTL;
    if (needsRestart) void Updates.reloadAsync();
  };

  return (
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('settings.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.language')}</Text>
        <Select
          label={t('settings.language')}
          value={locale}
          options={[
            { id: 'en', label: 'English' },
            { id: 'fa', label: 'فارسی' },
          ]}
          onSelect={(v) => void applyLocale(v as 'en' | 'fa')}
        />
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {I18nManager.isRTL ? t('settings.restartHint') : ''}
        </Text>
      </Card>

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.calendarType')}</Text>
        <Select
          label={t('settings.calendarType')}
          value={calendar}
          options={[
            { id: 'gregorian', label: t('settings.gregorian') },
            { id: 'jalali', label: t('settings.jalali') },
          ]}
          onSelect={(v) => setCalendar(v as 'gregorian' | 'jalali')}
        />
      </Card>

      <Card>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings.theme')}</Text>
        <Select
          label={t('settings.theme')}
          value={theme}
          options={[
            { id: 'system', label: t('settings.system') },
            { id: 'light', label: t('settings.light') },
            { id: 'dark', label: t('settings.dark') },
          ]}
          onSelect={(v) => setTheme(v as 'system' | 'light' | 'dark')}
        />
      </Card>

      <LeavePatternCard />
      <BackupCard />
    </ScrollView>
  );
}

function BackupCard() {
  const { t } = useTranslation();
  const colors = useTheme();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [dialog, setDialog] = useState<'backup' | 'restore' | null>(null);

  const runProgress: ProgressFn = (fraction) => setProgress(fraction);

  const doBackup = async (password: string) => {
    setDialog(null);
    setBusy(true);
    setStatus(null);
    setProgress(0);
    try {
      const { count } = await createBackup(password, runProgress);
      setStatus(t('settings.backupDone', { count }));
    } catch {
      setStatus(t('settings.backupFailed'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  // Commercial flow: choose file → its name appears below → press Restore →
  // enter the backup password → confirm overwrite → restore with progress.
  const chooseFile = async () => {
    setStatus(null);
    const picked = await pickBackupFile();
    if (picked) setPickedFile(picked);
  };

  const doRestore = (password: string) => {
    if (!pickedFile) return;
    setBusy(true);
    setProgress(0);
    const run = async () => {
      try {
        const { count, files } = await restoreBackup(pickedFile.uri, password, runProgress);
        setStatus(t('settings.restoreDone', { count, files }));
      } catch (err) {
        setStatus(
          err instanceof Error && err.message === 'WRONG_PASSWORD'
            ? t('settings.wrongPassword')
            : t('settings.restoreFailed')
        );
      } finally {
        setBusy(false);
        setProgress(null);
      }
    };
    void run();
  };

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.backupTitle')}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.md }}>
        {t('settings.backupPasswordHint')}
      </Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Button label={t('settings.backup')} onPress={() => setDialog('backup')} disabled={busy} style={{ flex: 1 }} />
        <Button
          label={pickedFile ? t('settings.restore') : t('settings.chooseFile')}
          onPress={() => (pickedFile ? setDialog('restore') : void chooseFile())}
          variant="secondary"
          disabled={busy}
          style={{ flex: 1 }}
        />
      </View>
      {pickedFile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {pickedFile.name}
          </Text>
          <Pressable onPress={() => setPickedFile(null)} hitSlop={6}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>{t('settings.changeFile')}</Text>
          </Pressable>
        </View>
      ) : null}
      {progress !== null ? (
        <View style={{ marginTop: Spacing.md }}>
          <ProgressBar progress={progress} tone="primary" />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : null}
      {status ? <Text style={{ color: colors.success, fontSize: 13, marginTop: Spacing.sm }}>{status}</Text> : null}
      {dialog === 'backup' ? (
        <BackupPasswordDialog
          title={t('settings.backupPasswordTitle')}
          hint={t('settings.backupPasswordRepeat')}
          onCancel={() => setDialog(null)}
          onConfirm={(password) => void doBackup(password)}
        />
      ) : null}
      {dialog === 'restore' ? (
        <BackupPasswordDialog
          title={t('settings.restorePasswordTitle')}
          hint={t('settings.backupPasswordHintRestore')}
          single
          onCancel={() => setDialog(null)}
          onConfirm={doRestore}
        />
      ) : null}
    </Card>
  );
}

/** Password popup: two fields (repeat) for backup, one field for restore. */
function BackupPasswordDialog({
  title,
  hint,
  single,
  onConfirm,
  onCancel,
}: {
  title: string;
  hint: string;
  single?: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!password.trim()) {
      setError(t('settings.passwordRequired'));
      return;
    }
    if (!single && password !== repeat) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    onConfirm(password);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
        <Pressable style={[styles.dialogSheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <Text style={[styles.dialogTitle, { color: colors.text }]}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.md }}>{hint}</Text>
          <LabeledInput
            label={t('settings.password')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secureTextEntry
          />
          {single ? null : (
            <LabeledInput
              label={t('settings.repeatPassword')}
              value={repeat}
              onChangeText={(v) => {
                setRepeat(v);
                setError(null);
              }}
              secureTextEntry
            />
          )}
          {error ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: Spacing.sm }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Pressable
              onPress={onCancel}
              style={[styles.dialogBtn, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              style={[styles.dialogBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t('common.confirm')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LeavePatternCard() {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: leaveSettings } = useLeaveSettings();
  const saveLeave = useSaveLeaveSettings();

  const [onboardDays, setOnboardDays] = useState<string | null>(null);
  const [leaveDays, setLeaveDays] = useState<string | null>(null);

  if (!leaveSettings) return null;

  const onboard = onboardDays ?? String(leaveSettings.onboardDays);
  const leave = leaveDays ?? String(leaveSettings.leaveDays);

  const save = () => {
    const normalize = (v: string) => parseFloat(v.replace(/[٫,]/g, '.').trim());
    const onboardNum = Math.round(normalize(onboard));
    const leaveNum = normalize(leave);
    const next: LeaveSettings = {
      ...leaveSettings,
      onboardDays: Number.isFinite(onboardNum) && onboardNum > 0 ? onboardNum : 60,
      leaveDays: Number.isFinite(leaveNum) && leaveNum >= 0 ? Math.round(leaveNum * 10) / 10 : 30,
    };
    saveLeave.mutate(next);
    setOnboardDays(null);
    setLeaveDays(null);
  };

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.leavePattern')}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
        {t('settings.modes.ratio')}: {leaveSettings.onboardDays}/{leaveSettings.leaveDays}
      </Text>
      <LabeledInput label={t('settings.onboardDays')} value={onboard} onChangeText={setOnboardDays} keyboardType="numeric" />
      <LabeledInput label={t('settings.leaveDays')} value={leave} onChangeText={setLeaveDays} keyboardType="numeric" />
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
        {t('settings.leaveDecimalHint')}
      </Text>
      <Button label={t('common.save')} onPress={save} variant="secondary" />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  dialogBackdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.xl },
  dialogSheet: { borderRadius: Radius.lg, padding: Spacing.lg },
  dialogTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  dialogBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, alignItems: 'center' },
});
