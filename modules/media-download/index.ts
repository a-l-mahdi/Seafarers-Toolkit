import { requireNativeModule } from 'expo-modules-core';

/**
 * Local Expo module that writes a file straight into the public Downloads
 * collection via Android's MediaStore API. On Android 10 (API 29) and above this
 * needs NO storage permission and shows NO folder picker. Below API 29 the native
 * side reports `isSupported === false` and callers should fall back to sharing.
 */
interface MediaDownloadModule {
  /** true on Android 10+ (API 29+), where MediaStore Downloads is usable without permission. */
  readonly isSupported: boolean;
  /**
   * Writes `base64` data to Downloads/<fileName>. Returns the saved display name.
   * Rejects on unsupported OS versions or write failures.
   */
  saveToDownloads(base64: string, fileName: string, mimeType: string): Promise<string>;
}

export default requireNativeModule<MediaDownloadModule>('MediaDownload');
