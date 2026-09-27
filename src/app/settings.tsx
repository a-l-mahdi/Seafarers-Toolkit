import { useState, type ReactNode } from 'react';
import { I18nManager, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, ProgressBar } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { LabeledInput } from '@/components/ui/form';
import { ActionArt, BackupArt, CalendarArt, LanguageArt, LockArt, ThemePreview } from '@/components/settings-art';
import { useLeaveSettings, useSaveLeaveSettings } from '@/hooks/queries';
import { useSettingsStore, type CalendarPreference, type ThemePreference } from '@/store/settings-store';
import { changeLocale, isRTL, type Locale } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import { showSavedToast } from '@/components/saved-toast';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import * as Updates from 'expo-updates';
import { useQueryClient } from '@tanstack/react-query';
import { createBackup, pickBackupFile, restoreBackup, type ProgressFn } from '@/services/backup';
import { resyncNotifications } from '@/services/notification-service';
import { FileReadyModal } from '@/components/file-ready-modal';
import type { ReadyFile } from '@/services/file-share';
import type { LeaveSettings } from '@/types/domain';
import { gregorianToJalali, todayISO } from '@/utils/date';

type IconName = keyof typeof Ionicons.glyphMap;

const SOCIAL = [
  { key: 'telegram', url: 'https://t.me/seafarers_toolkit', icon: require('@/assets/images/telegram.png') },
  { key: 'bale', url: 'https://ble.ir/seafarers_toolkit', icon: require('@/assets/images/bale.png') },
] as const;

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
const GREGORIAN_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const faDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const router = useRouter();
  const { locale, theme, calendar, setLocale, setTheme, setCalendar } = useSettingsStore();

  const applyLocale = async (next: Locale) => {
    if (next === locale) return;
    setLocale(next);
    await changeLocale(next);
    const needsRestart = isRTL(next) !== I18nManager.isRTL;
    if (needsRestart) void Updates.reloadAsync();
  };

  // Today's date on each calendar, for the calendar tiles.
  const today = todayISO();
  const [, jm, jd] = gregorianToJalali(today).split('/');
  const [, gm, gd] = today.split('-');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader title={t('settings.title')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.container,
          { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom },
        ]}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <Card>
          <SectionHeader icon="language" title={t('settings.language')} />
          <View style={styles.tileRow}>
            <ChoiceTile selected={locale === 'fa'} onPress={() => void applyLocale('fa')}>
              <LanguageArt glyph="فا" />
              <Text style={[styles.tileTitle, { color: colors.text }]}>فارسی</Text>
            </ChoiceTile>
            <ChoiceTile selected={locale === 'en'} onPress={() => void applyLocale('en')}>
              <LanguageArt glyph="En" />
              <Text style={[styles.tileTitle, { color: colors.text }]}>English</Text>
            </ChoiceTile>
          </View>
        </Card>

        <Card>
          <SectionHeader icon="calendar" title={t('settings.calendarType')} />
          <View style={styles.tileRow}>
            {(
              [
                {
                  id: 'jalali',
                  day: faDigits(String(Number(jd))),
                  caption: JALALI_MONTHS[Number(jm) - 1] ?? '',
                  sample: faDigits(gregorianToJalali(today)),
                },
                {
                  id: 'gregorian',
                  day: String(Number(gd)),
                  caption: GREGORIAN_MONTHS[Number(gm) - 1] ?? '',
                  sample: today,
                },
              ] as const
            ).map((c) => (
              <ChoiceTile
                key={c.id}
                selected={calendar === c.id}
                onPress={() => setCalendar(c.id as CalendarPreference)}
              >
                <CalendarArt day={c.day} caption={c.caption} />
                <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
                  {t(`settings.${c.id}`)}
                </Text>
                <Text style={[styles.tileCaption, { color: colors.textMuted }]}>{c.sample}</Text>
              </ChoiceTile>
            ))}
          </View>
        </Card>

        <Card>
          <SectionHeader icon="color-palette" title={t('settings.theme')} />
          <View style={styles.tileRow}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <ChoiceTile
                key={mode}
                selected={theme === mode}
                onPress={() => setTheme(mode as ThemePreference)}
                compact
              >
                <ThemePreview mode={mode} width={64} />
                <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
                  {t(`settings.${mode}`)}
                </Text>
              </ChoiceTile>
            ))}
          </View>
        </Card>

        <LeavePatternCard />
        <BackupCard />
        <SocialLinks />
      </ScrollView>
    </View>
  );
}

/** The app's channels, at the bottom of the page. */
function SocialLinks() {
  const { t } = useTranslation();
  const colors = useTheme();
  return (
    <View style={styles.social}>
      <Text style={[styles.socialTitle, { color: colors.textMuted }]}>{t('settings.social')}</Text>
      <View style={styles.tileRow}>
        {SOCIAL.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => void Linking.openURL(s.url)}
            style={({ pressed }) => [
              styles.socialTile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Image source={s.icon} style={styles.socialIcon} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.socialName, { color: colors.text }]} numberOfLines={1}>
                {t(`settings.${s.key}`)}
              </Text>
              <Text style={[styles.socialHandle, { color: colors.textMuted }]} numberOfLines={1}>
                @seafarers_toolkit
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SectionHeader({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.primaryMuted }]}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** A selectable card: ocean outline, soft tint and a check badge when chosen. */
function ChoiceTile({
  selected,
  onPress,
  compact,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        compact && styles.tileCompact,
        {
          backgroundColor: selected ? colors.primaryMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {children}
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
          <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
        </View>
      ) : null}
    </Pressable>
  );
}

function BackupCard() {
  const { t } = useTranslation();
  const colors = useTheme();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string } | null>(null);
  const [readyFile, setReadyFile] = useState<ReadyFile | null>(null);
  const [dialog, setDialog] = useState<'backup' | 'restore' | null>(null);
  const { locale, theme, calendar, setLocale, setTheme, setCalendar } = useSettingsStore();
  const queryClient = useQueryClient();

  const runProgress: ProgressFn = (fraction) => setProgress(fraction);

  const doBackup = async (password: string) => {
    setDialog(null);
    setBusy(true);
    setStatus(null);
    setProgress(0);
    try {
      const { count, file } = await createBackup(password, runProgress, { locale, theme, calendar });
      setStatus({ text: t('settings.backupDone', { count }), tone: 'success' });
      setReadyFile(file);
    } catch {
      setStatus({ text: t('settings.backupFailed'), tone: 'error' });
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
    // Close the password popup immediately; the progress bar takes over.
    setDialog(null);
    setBusy(true);
    setProgress(0);
    const run = async () => {
      try {
        const { count, files, appSettings } = await restoreBackup(pickedFile.uri, password, runProgress);
        // The restore rewrote the database directly, so every cached query is now
        // stale — refetch them all so Home/Profile, Documents, etc. update without
        // needing an app restart.
        await queryClient.invalidateQueries();
        // Bring back language/theme/calendar exactly as they were backed up.
        if (appSettings) {
          const restoredLocale = (appSettings.locale === 'fa' ? 'fa' : 'en') as 'en' | 'fa';
          setLocale(restoredLocale);
          await changeLocale(restoredLocale);
          setTheme(appSettings.theme === 'dark' || appSettings.theme === 'light' ? appSettings.theme : 'system');
          setCalendar(appSettings.calendar === 'jalali' ? 'jalali' : 'gregorian');
          // Language direction flip needs a restart to take effect.
          if (isRTL(restoredLocale) !== I18nManager.isRTL) {
            void Updates.reloadAsync();
          }
        }
        // Schedule the restored documents', trips' and notes' reminders now
        // (in the restored language) instead of waiting for the next launch.
        void resyncNotifications().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
        setStatus({ text: t('settings.restoreDone', { count, files }), tone: 'success' });
      } catch (err) {
        setStatus({
          text: `${t('settings.restoreFailed')} — ${err instanceof Error ? err.message : String(err ?? 'unknown')}`,
          tone: 'error',
        });
      } finally {
        setBusy(false);
        setProgress(null);
      }
    };
    void run();
  };

  return (
    <Card>
      <View style={styles.backupTop}>
        <BackupArt size={80} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.backupTitle')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 19 }}>
            {t('settings.backupPasswordHint')}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <ActionTile
          kind="backup"
          label={t('settings.backup')}
          filled
          disabled={busy}
          onPress={() => setDialog('backup')}
        />
        <ActionTile
          kind={pickedFile ? 'restore' : 'file'}
          label={pickedFile ? t('settings.restore') : t('settings.chooseFile')}
          disabled={busy}
          onPress={() => (pickedFile ? setDialog('restore') : void chooseFile())}
        />
      </View>

      {pickedFile ? (
        <View style={[styles.fileChip, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="document-lock-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
            {pickedFile.name}
          </Text>
          <Pressable onPress={() => setPickedFile(null)} hitSlop={6} disabled={busy}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('settings.changeFile')}</Text>
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
      {status ? (
        <View
          style={[
            styles.status,
            { backgroundColor: status.tone === 'error' ? colors.dangerMuted : colors.primaryMuted },
          ]}
        >
          <Ionicons
            name={status.tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={18}
            color={status.tone === 'error' ? colors.danger : colors.primary}
          />
          <Text style={{ color: status.tone === 'error' ? colors.danger : colors.text, fontSize: 13, flex: 1 }}>
            {status.text}
          </Text>
        </View>
      ) : null}
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
      <FileReadyModal file={readyFile} onClose={() => setReadyFile(null)} />
    </Card>
  );
}

function ActionTile({
  kind,
  label,
  filled,
  disabled,
  onPress,
}: {
  kind: 'backup' | 'restore' | 'file';
  label: string;
  filled?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: filled ? colors.primaryMuted : colors.surface,
          borderColor: filled ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <ActionArt kind={kind} size={40} />
      <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
          <View style={[styles.dialogSheet, { backgroundColor: colors.surface }]}>
            <View style={{ alignItems: 'center', marginBottom: Spacing.sm }}>
              <LockArt />
            </View>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>{title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: Spacing.md, textAlign: 'center' }}>
              {hint}
            </Text>
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
            {error ? (
              <Text style={{ color: colors.danger, fontSize: 13, marginBottom: Spacing.sm }}>{error}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Pressable onPress={onCancel} style={[styles.dialogBtn, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={confirm} style={[styles.dialogBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('common.confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  const onboard = onboardDays ?? String(leaveSettings?.onboardDays ?? '');
  const leave = leaveDays ?? String(leaveSettings?.leaveDays ?? '');
  const dirty = onboardDays !== null || leaveDays !== null;

  const save = () => {
    if (!leaveSettings) return;
    const normalize = (v: string) => parseFloat(v.replace(/[٫,]/g, '.').trim());
    const onboardNum = Math.round(normalize(onboard));
    const leaveNum = normalize(leave);
    const next: LeaveSettings = {
      ...leaveSettings,
      onboardDays: Number.isFinite(onboardNum) && onboardNum > 0 ? onboardNum : 60,
      leaveDays: Number.isFinite(leaveNum) && leaveNum >= 0 ? Math.round(leaveNum * 10) / 10 : 30,
    };
    saveLeave.mutate(next);
    showSavedToast();
    setOnboardDays(null);
    setLeaveDays(null);
  };
  useUnsavedGuard(dirty, () => {
    save();
    return true;
  });

  if (!leaveSettings) return null;

  return (
    <Card>
      <SectionHeader
        icon="sunny"
        title={t('settings.leavePattern')}
        right={
          <View style={[styles.ratio, { backgroundColor: colors.primaryMuted }]}>
            <Ionicons name="boat" size={13} color={colors.primary} />
            <Text style={[styles.ratioText, { color: colors.primary }]}>
              {leaveSettings.onboardDays} : {leaveSettings.leaveDays}
            </Text>
            <Ionicons name="home" size={13} color={colors.primary} />
          </View>
        }
      />
      <View style={styles.leaveRow}>
        <View style={{ flex: 1 }}>
          <LabeledInput
            label={t('settings.onboardDays')}
            value={onboard}
            onChangeText={setOnboardDays}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput
            label={t('settings.leaveDays')}
            value={leave}
            onChangeText={setLeaveDays}
            keyboardType="numeric"
          />
        </View>
      </View>
      <Pressable
        onPress={save}
        disabled={!dirty}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: colors.primary, opacity: !dirty ? 0.45 : pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('common.save')}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '800' },

  tileRow: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
  },
  tileCompact: { paddingVertical: Spacing.sm + 2 },
  tileTitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  tileCaption: { fontSize: 11.5, writingDirection: 'ltr' },
  check: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  ratioText: { fontSize: 13, fontWeight: '800', writingDirection: 'ltr' },
  leaveRow: { flexDirection: 'row', gap: Spacing.sm },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },

  backupTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },

  social: { marginTop: Spacing.sm, gap: Spacing.sm },
  socialTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  socialTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  socialIcon: { width: 36, height: 36 },
  socialName: { fontSize: 14, fontWeight: '700' },
  socialHandle: { fontSize: 11, writingDirection: 'ltr' },

  dialogBackdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.xl },
  dialogSheet: { borderRadius: Radius.lg + 4, padding: Spacing.lg },
  dialogTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  dialogBtn: { flex: 1, paddingVertical: Spacing.sm + 4, borderRadius: Radius.md, alignItems: 'center' },
});
