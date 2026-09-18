import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import MediaDownload from '../../modules/media-download';

export interface ReadyFile {
  uri: string;
  name: string;
  mime: string;
}

/** Opens the OS share sheet so the user can send the file to a messenger, etc. */
export async function shareFile(file: ReadyFile): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: file.mime, dialogTitle: file.name });
  }
}

export type DownloadResult = 'saved' | 'shared' | 'cancelled';

/**
 * Saves the file to the phone's public Downloads folder.
 *
 * On Android 10+ (API 29+) this uses MediaStore, which needs NO storage
 * permission and shows NO folder picker — the file lands directly in Downloads.
 * On Android 9 and below (where MediaStore Downloads is unavailable and writing
 * there would need WRITE_EXTERNAL_STORAGE — a permission the Iranian stores flag)
 * we fall back to the share sheet so the user can still keep the file.
 */
export async function downloadFile(file: ReadyFile): Promise<DownloadResult> {
  if (Platform.OS !== 'android') {
    await shareFile(file);
    return 'shared';
  }

  if (!MediaDownload.isSupported) {
    await shareFile(file);
    return 'shared';
  }

  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await MediaDownload.saveToDownloads(base64, file.name, file.mime);
  return 'saved';
}
