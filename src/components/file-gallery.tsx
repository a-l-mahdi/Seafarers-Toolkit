import { useState } from 'react';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { DockDivider, FitImage, ViewerAction, ZoomViewer } from '@/components/zoom-viewer';
import { Text } from '@/components/ui/text';
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
          <Pressable onPress={() => void shareFile(file.uri, file.name)} style={styles.pdfAction}>
            <Text style={{ color: colors.primary }}>⤴</Text>
          </Pressable>
          {onRemove ? (
            <Pressable onPress={() => onRemove(file.id, file.uri)} style={styles.pdfAction}>
              <Text style={{ color: colors.danger }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <ViewerModal file={viewerUri} files={images} onClose={() => setViewerUri(null)} onRemove={onRemove} />
    </View>
  );
}

/**
 * Full-screen photo viewer (zoom, swipe between `files`) with Share / Delete.
 * `file` is the photo it opens on; `null` keeps it closed.
 */
export function ViewerModal({
  file,
  files,
  onClose,
  onRemove,
  onIndexChange,
}: {
  file: DisplayFile | null;
  /** The photos to swipe through; just `file` when omitted. */
  files?: DisplayFile[];
  onClose: () => void;
  onRemove?: (id: string, uri: string) => void;
  onIndexChange?: (file: DisplayFile) => void;
}) {
  const { t } = useTranslation();
  if (!file) return null;
  const list = files?.some((f) => f.id === file.id) ? files : [file];

  const doRemove = (target: DisplayFile) => {
    if (!onRemove) return;
    Alert.alert(t('common.delete'), target.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          onRemove(target.id, target.uri);
          onClose();
        },
      },
    ]);
  };

  return (
    <ZoomViewer
      items={list}
      initialIndex={list.findIndex((f) => f.id === file.id)}
      keyOf={(f) => f.id}
      renderItem={(f, box) => <FitImage uri={f.uri} box={box} />}
      title={(i) => list[i].name}
      onIndexChange={(i) => onIndexChange?.(list[i])}
      onClose={onClose}
      actions={(i) => (
        <>
          <ViewerAction
            icon="share-social"
            label={t('common.share')}
            tint="#2F80ED"
            onPress={() => void shareFile(list[i].uri, list[i].name)}
          />
          {onRemove ? (
            <>
              <DockDivider />
              <ViewerAction icon="trash" label={t('common.delete')} tint="#FF4D5E" onPress={() => doRemove(list[i])} />
            </>
          ) : null}
        </>
      )}
    />
  );
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
});
