import { useState } from 'react';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';

export interface DisplayFile {
  id: string;
  uri: string;
  name: string;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

export function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Square thumbnail grid for attached files (images as thumbs, PDFs as rows).
 * Tapping an image opens a full-screen viewer with Share / Delete / Close.
 */
export function FileGallery({
  files,
  onRemove,
  emptyHint,
  large,
}: {
  files: DisplayFile[];
  onRemove?: (id: string, uri: string) => void;
  emptyHint?: string | null;
  /** Big gallery-style tiles (3 per row) instead of the compact 72px thumbs. */
  large?: boolean;
}) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [viewerUri, setViewerUri] = useState<DisplayFile | null>(null);
  const images = files.filter((f) => isImageFile(f.name));
  const others = files.filter((f) => !isImageFile(f.name));
  // 3 columns with the screen's side padding (Spacing.lg = 16) and gaps (8).
  const tile = large ? Math.floor((width - 2 * 16 - 2 * Spacing.sm) / 3) : 72;
  const tileStyle = { width: tile, height: tile };

  return (
    <View style={styles.wrap}>
      {files.length === 0 && emptyHint ? (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{emptyHint}</Text>
      ) : null}
      <View style={styles.grid}>
        {images.map((file) => (
          <View key={file.id} style={tileStyle}>
            <Pressable
              onPress={() => setViewerUri(file)}
              style={[styles.thumb, tileStyle, { backgroundColor: colors.surfaceMuted }]}
            >
              <Image source={{ uri: file.uri }} style={styles.thumbImage} contentFit="cover" />
            </Pressable>
            {onRemove ? (
              <Pressable
                onPress={() => onRemove(file.id, file.uri)}
                style={[styles.removeBtn, { backgroundColor: colors.danger }]}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      {others.map((file) => (
        <View key={file.id} style={[styles.pdfRow, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>PDF</Text>
          <Text style={{ color: colors.text, flex: 1, marginHorizontal: Spacing.sm }} numberOfLines={1}>
            {file.name}
          </Text>
          <Pressable
            onPress={() => void shareFile(file.uri, file.name)}
            style={styles.pdfAction}
          >
            <Text style={{ color: colors.primary }}>⤴</Text>
          </Pressable>
          {onRemove ? (
            <Pressable onPress={() => onRemove(file.id, file.uri)} style={styles.pdfAction}>
              <Text style={{ color: colors.danger }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <ViewerModal file={viewerUri} onClose={() => setViewerUri(null)} onRemove={onRemove} />
    </View>
  );
}

function ViewerModal({
  file,
  onClose,
  onRemove,
}: {
  file: DisplayFile | null;
  onClose: () => void;
  onRemove?: (id: string, uri: string) => void;
}) {
  const { t } = useTranslation();

  const doRemove = () => {
    if (file && onRemove) {
      onRemove(file.id, file.uri);
    }
    onClose();
  };

  return (
    <Modal visible={!!file} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <View style={styles.viewerTop}>
          <Text style={{ color: '#FFFFFF', flex: 1, marginHorizontal: Spacing.md }} numberOfLines={1}>
            {file?.name ?? ''}
          </Text>
          <Pressable style={styles.viewerBtn} onPress={() => file && void shareFile(file.uri, file.name)}>
            <IoniconsShare />
          </Pressable>
          {onRemove ? (
            <Pressable style={styles.viewerBtn} onPress={doRemove}>
              <Text style={{ color: '#FF8A7A', fontSize: 20 }}>🗑</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.viewerBtn} onPress={onClose}>
            <Text style={{ color: '#FFFFFF', fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>
        {file ? <Image source={{ uri: file.uri }} style={styles.viewerImage} contentFit="contain" /> : null}
        <Text style={{ color: '#FFFFFFAA', fontSize: 12, textAlign: 'center', paddingBottom: Spacing.xl }}>
          {t('common.share')}
        </Text>
      </View>
    </Modal>
  );
}

function IoniconsShare() {
  return <Text style={{ color: '#FFFFFF', fontSize: 20 }}>⤴</Text>;
}

export async function shareFile(uri: string, fileName: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: isImageFile(fileName) ? 'image/jpeg' : 'application/octet-stream',
      dialogTitle: fileName,
    });
  }
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000020',
  },
  thumbImage: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  removeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  pdfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  pdfAction: { paddingHorizontal: Spacing.sm },
  viewerBackdrop: { flex: 1, backgroundColor: '#000000EE', paddingTop: Spacing.xl },
  viewerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  viewerBtn: { padding: Spacing.sm },
  viewerImage: { flex: 1, width: '100%' },
});
