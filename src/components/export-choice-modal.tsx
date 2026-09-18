import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { downloadFile, shareFile, type ReadyFile } from '@/services/file-share';

export interface ExportFormat {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Produces the file on demand (only when the user taps an action). */
  generate: () => Promise<ReadyFile>;
}

/**
 * A single-button export flow: shows every format, each with its own Download and
 * Share action. Files are generated lazily on first tap and cached for the session
 * so a second action on the same format is instant. The green result line auto-hides.
 */
export function ExportChoiceModal({
  visible,
  title,
  formats,
  onClose,
}: {
  visible: boolean;
  title: string;
  formats: ExportFormat[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const cache = useRef<Record<string, ReadyFile>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setStatus(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 3000);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = async (fmt: ExportFormat, action: 'download' | 'share') => {
    if (busy) return;
    setBusy(`${fmt.key}:${action}`);
    setStatus(null);
    try {
      let file = cache.current[fmt.key];
      if (!file) {
        file = await fmt.generate();
        cache.current[fmt.key] = file;
      }
      if (action === 'share') {
        await shareFile(file);
      } else {
        const res = await downloadFile(file);
        if (res === 'saved') flash(t('files.saved'));
      }
    } catch {
      flash(t('files.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {formats.map((fmt) => (
            <View key={fmt.key} style={[styles.row, { borderColor: colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
                <Ionicons name={fmt.icon} size={22} color={colors.primary} />
              </View>
              <Text style={[styles.fmtLabel, { color: colors.text }]} numberOfLines={1}>
                {fmt.label}
              </Text>

              <Pressable
                onPress={() => void run(fmt, 'download')}
                disabled={busy !== null}
                style={[styles.act, { backgroundColor: colors.surfaceMuted }]}
              >
                {busy === `${fmt.key}:download` ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color={colors.primary} />
                    <Text style={[styles.actText, { color: colors.primary }]}>{t('files.download')}</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => void run(fmt, 'share')}
                disabled={busy !== null}
                style={[styles.act, { backgroundColor: colors.primary }]}
              >
                {busy === `${fmt.key}:share` ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={16} color={colors.onPrimary} />
                    <Text style={[styles.actText, { color: colors.onPrimary }]}>{t('files.share')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          ))}

          {status ? <Text style={[styles.status, { color: colors.success }]}>{status}</Text> : null}

          <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
            <Text style={{ color: colors.textMuted }}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.xl },
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fmtLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  act: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 74,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  actText: { fontSize: 12, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '600', marginTop: Spacing.md, textAlign: 'center' },
  close: { marginTop: Spacing.md, padding: Spacing.sm, alignSelf: 'center' },
});
