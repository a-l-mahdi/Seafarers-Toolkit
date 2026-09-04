import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentFile } from '@/types/domain';

const DOCUMENTS_DIR = `${FileSystem.documentDirectory ?? ''}documents/`;

export async function ensureDocumentsDir(): Promise<string> {
  const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
  }
  return DOCUMENTS_DIR;
}

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export async function pickDocumentFile(): Promise<{
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  };
}

export async function importPickedFile(
  documentId: string,
  picked: { uri: string; name: string; mimeType: string | null; size: number | null }
): Promise<string> {
  const dir = await ensureDocumentsDir();
  const docDir = `${dir}${documentId}/`;
  const info = await FileSystem.getInfoAsync(docDir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(docDir, { intermediates: true });
  const extension = picked.name.includes('.') ? picked.name.slice(picked.name.lastIndexOf('.')) : '';
  const dest = `${docDir}${Date.now()}_${Math.floor(Math.random() * 1e6)}${extension}`;
  await FileSystem.copyAsync({ from: picked.uri, to: dest });
  return dest;
}

export async function removeImportedFile(localPath: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) await FileSystem.deleteAsync(localPath, { idempotent: true });
  } catch {
    // non-fatal
  }
}

export function isAllowedFileType(mimeType: string | null, fileName: string): boolean {
  if (mimeType && ALLOWED_MIME.includes(mimeType.toLowerCase())) return true;
  const lower = fileName.toLowerCase();
  return ['.pdf', '.jpg', '.jpeg', '.png'].some((ext) => lower.endsWith(ext));
}

export function fileRecord(documentId: string, picked: { name: string; mimeType: string | null; size: number | null }, localPath: string): Omit<DocumentFile, 'id' | 'createdAt'> {
  return {
    documentId,
    localPath,
    fileName: picked.name,
    mimeType: picked.mimeType,
    size: picked.size,
  };
}
