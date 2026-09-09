import { useState } from 'react';
import { Alert, I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui/primitives';
import { LabeledInput, Select } from '@/components/ui/form';
import { useLeaveSettings, useSaveLeaveSettings } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings-store';
import { changeLocale, isRTL } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import * as Updates from 'expo-updates';
import { createBackup, restoreBackup } from '@/services/backup';
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
    <ScrollView nestedScrollEnabled contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
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

  const doBackup = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { count } = await createBackup();
      setStatus(t('settings.backupDone', { count }));
    } catch {
      setStatus(t('settings.backupFailed'));
    } finally {
      setBusy(false);
    }
  };

  const doRestore = () => {
    Alert.alert(t('settings.restore'), t('settings.restoreConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setStatus(null);
          try {
            const { count, files } = await restoreBackup();
            setStatus(t('settings.restoreDone', { count, files }));
          } catch {
            setStatus(t('settings.restoreFailed'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings.backupTitle')}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.md }}>
        {t('settings.backupHint')}
      </Text>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Button label={t('settings.backup')} onPress={() => void doBackup()} disabled={busy} style={{ flex: 1 }} />
        <Button label={t('settings.restore')} onPress={doRestore} variant="secondary" disabled={busy} style={{ flex: 1 }} />
      </View>
      {status ? <Text style={{ color: colors.success, fontSize: 13, marginTop: Spacing.sm }}>{status}</Text> : null}
    </Card>
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
});
