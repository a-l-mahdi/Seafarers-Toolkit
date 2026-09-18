import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import { downloadFile, shareFile, type ReadyFile } from '@/services/file-share';

function iconFor(mime: string): keyof typeof Ionicons.glyphMap {
  if (mime.includes('pdf')) return 'document-text';
  if (mime.includes('sheet') || mime.includes('excel')) return 'grid';
  return 'archive';
}

/** Shown after a file is generated: the file as an icon + Share / Download. */
export function FileReadyModal({ file, onClose }: { file: ReadyFile | null; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!file) return null;

  const doShare = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await shareFile(file);
    } finally {
      setBusy(false);
    }
  };
  const doDownload = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await downloadFile(file);
      if (result === 'saved') setStatus(t('files.saved'));
    } catch {
      setStatus(t('files.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => undefined}>
          <Text style={[styles.title, { color: colors.text }]}>{t('files.ready')}</Text>

          <View style={styles.fileRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
              <Ionicons name={iconFor(file.mime)} size={30} color={colors.primary} />
            </View>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>
              {file.name}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void doShare()}
              disabled={busy}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.onPrimary} />
              <Text style={[styles.btnText, { color: colors.onPrimary }]}>{t('files.share')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void doDownload()}
              disabled={busy}
              style={[styles.btn, { backgroundColor: colors.surfaceMuted }]}
            >
              <Ionicons name="download-outline" size={18} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.primary }]}>{t('files.download')}</Text>
            </Pressable>
          </View>

          {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.sm }} /> : null}
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
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg, alignSelf: 'stretch' },
  iconWrap: { width: 54, height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, fontSize: 14, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: Spacing.md, alignSelf: 'stretch' },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 13,
    borderRadius: Radius.md,
  },
  btnText: { fontSize: 15, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '600', marginTop: Spacing.sm },
  close: { marginTop: Spacing.md, padding: Spacing.sm },
});
