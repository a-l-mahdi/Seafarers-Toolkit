import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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

export type DownloadResult = 'saved' | 'cancelled';

/**
 * Saves the file to a user-picked folder (Android Storage Access Framework — e.g.
 * Downloads). Returns 'cancelled' if the user dismisses the folder picker.
 */
export async function downloadFile(file: ReadyFile): Promise<DownloadResult> {
  if (Platform.OS !== 'android') {
    await shareFile(file);
    return 'saved';
  }
  const SAF = FileSystem.StorageAccessFramework;
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return 'cancelled';
  const content = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const base = file.name.replace(/\.[^.]+$/, ''); // SAF adds the extension from the mime type
  const dest = await SAF.createFileAsync(perm.directoryUri, base, file.mime);
  await FileSystem.writeAsStringAsync(dest, content, { encoding: FileSystem.EncodingType.Base64 });
  return 'saved';
}
