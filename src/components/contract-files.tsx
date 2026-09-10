import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileGallery, type DisplayFile } from '@/components/file-gallery';
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
      <FileGroup title={t('tripFiles.contract')} contractId={contractId} kind="contract" />
      <FileGroup title={t('tripFiles.seaServiceReport')} contractId={contractId} kind="sea_service_report" />
      <FileGroup title={t('tripFiles.finalWages')} contractId={contractId} kind="final_wages" />
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
  const [menuFor, setMenuFor] = useState(false);

  const addTo = async (uri: string, name: string) => {
    const localPath = await importUriFile(`trips/${contractId}`, uri, name);
    addFile.mutate({
      contractId,
      seaTimeId: null,
      kind,
      localPath,
      fileName: name,
      mimeType: null,
      size: null,
    });
  };

  const addFrom = async (source: 'camera' | 'gallery' | 'file') => {
    setMenuFor(false);
    let uri: string | null = null;
    let name: string;
    if (source === 'camera') {
      uri = await capturePhoto();
      name = `trip_${Date.now()}.jpg`;
    } else if (source === 'gallery') {
      uri = await pickPhoto();
      name = `trip_${Date.now()}.jpg`;
    } else {
      const picked = await pickDocumentFile();
      if (!picked) return;
      if (!isAllowedFileType(picked.mimeType, picked.name)) return;
      uri = picked.uri;
      name = picked.name;
    }
    if (uri) void addTo(uri, name);
  };

  const display: DisplayFile[] = (files ?? []).map((f) => ({
    id: f.id,
    uri: f.localPath,
    name: f.fileName,
  }));

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
      <FileGallery
        files={display}
        onRemove={(id) => {
          const file = files?.find((f) => f.id === id);
          if (file) {
            void removeImportedFile(file.localPath);
            deleteFile.mutate(file.id);
          }
        }}
      />
      {menuFor ? (
        <View style={[styles.menu, { borderColor: colors.border }]}>
          <Pressable style={styles.menuItem} onPress={() => void addFrom('camera')}>
            <Text style={{ color: colors.text }}>{t('tripFiles.camera')}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => void addFrom('gallery')}>
            <Text style={{ color: colors.text }}>{t('tripFiles.gallery')}</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => void addFrom('file')}>
            <Text style={{ color: colors.text }}>{t('tripFiles.pdf')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => setMenuFor(true)}>
          + {t('tripFiles.add')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.md, gap: Spacing.lg },
  group: { gap: Spacing.sm },
  groupTitle: { fontSize: 14, fontWeight: '700' },
  menu: { borderWidth: 1, borderRadius: Radius.sm, overflow: 'hidden', marginVertical: 4 },
  menuItem: { paddingVertical: 10, paddingHorizontal: Spacing.md },
});
