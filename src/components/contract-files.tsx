import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useAddTripFile, useDeleteTripFile, useTripFiles } from '@/hooks/queries';
import { capturePhoto, pickPhoto } from '@/services/image-capture';
import { pickDocumentFile, importUriFile, isAllowedFileType, removeImportedFile } from '@/services/file-storage';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/constants/theme';
import type { TripFileKind } from '@/database/repositories/trip-files-repository';

/**
 * Attachments for a contract/trip: the scanned contract copy and the
 * final wages account statement. Fully local — files live on the device.
 */
export function ContractFilesSection({ contractId, compact }: { contractId: string; compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <View style={compact ? undefined : styles.section}>
      <FileGroup
        title={t('tripFiles.contract')}
        contractId={contractId}
        kind="contract"
      />
      <FileGroup
        title={t('tripFiles.finalWages')}
        contractId={contractId}
        kind="final_wages"
      />
    </View>
  );
}

function FileGroup({
  title,
  contractId,
  kind,
}: {
  title: string;
  contractId: string;
  kind: TripFileKind;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { data: files } = useTripFiles({ contractId, kind });
  const addFile = useAddTripFile();
  const deleteFile = useDeleteTripFile();
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const addTo = async (uri: string, name: string) => {
    const localPath = await importUriFile(`trips/${contractId}`, uri, name);
    addFile.mutate({ contractId, seaTimeId: null, kind, localPath, fileName: name, mimeType: null, size: null });
  };

  const addFromCamera = async () => {
    const uri = await capturePhoto();
    if (uri) void addTo(uri, `trip_${Date.now()}.jpg`);
  };

  const addFromGallery = async () => {
    const uri = await pickPhoto();
    if (uri) void addTo(uri, `trip_${Date.now()}.jpg`);
  };

  const addFromFiles = async () => {
    const picked = await pickDocumentFile();
    if (!picked) return;
    if (!isAllowedFileType(picked.mimeType, picked.name)) return;
    void addTo(picked.uri, picked.name);
  };

  const open = async (localPath: string, fileName: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localPath, { mimeType: 'application/octet-stream', dialogTitle: fileName });
    }
  };

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
      {(files ?? []).map((file) => (
        <View key={file.id} style={[styles.fileRow, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={{ color: colors.primary }} onPress={() => void open(file.localPath, file.fileName)}>
            {'› '}
          </Text>
          <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
            {file.fileName}
          </Text>
          <Text
            style={{ color: colors.danger, paddingHorizontal: 8 }}
            onPress={() => {
              void removeImportedFile(file.localPath);
              deleteFile.mutate(file.id);
            }}
          >
            ✕
          </Text>
        </View>
      ))}
      {menuFor === kind ? (
        <View style={[styles.menu, { borderColor: colors.border }]}>
          <Pressable style={styles.menuItem} onPress={() => { setMenuFor(null); void addFromCamera(); }}>
            <Text style={{ color: colors.text }}>{t('tripFiles.camera')}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => { setMenuFor(null); void addFromGallery(); }}>
            <Text style={{ color: colors.text }}>{t('tripFiles.gallery')}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => { setMenuFor(null); void addFromFiles(); }}>
            <Text style={{ color: colors.text }}>{t('tripFiles.pdf')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => setMenuFor(kind)}>
          + {t('tripFiles.add')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.md, gap: Spacing.md },
  group: { gap: Spacing.xs },
  groupTitle: { fontSize: 14, fontWeight: '700' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
  },
  menu: { borderWidth: 1, borderRadius: Radius.sm, overflow: 'hidden', marginVertical: 4 },
  menuItem: { paddingVertical: 10, paddingHorizontal: Spacing.md },
});
