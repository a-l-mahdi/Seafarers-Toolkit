import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { openDatabase } from '@/database/db';
import { base64ToBytes } from '@/utils/xor-codec';
import {
  buildContainerBytes,
  parseContainerHeader,
  type ContainerFileEntry,
  type ContainerHeader,
} from '@/utils/backup-container';

const TABLES = [
  'ranks',
  'profile',
  'vessels',
  'contracts',
  'sea_time_records',
  'documents',
  'document_files',
  'trip_files',
  'document_types',
  'notifications',
  'settings',
] as const;

const BACKUP_VERSION = 2;

/**
 * Insert order for restore: parents BEFORE children, otherwise the FK
 * constraints (documents ← document_files, contracts ← trip_files, …) fail
 * with "FOREIGN KEY constraint failed" as soon as documents with photos exist.
 */
const INSERT_ORDER = [
  'ranks',
  'document_types',
  'vessels',
  'profile',
  'settings',
  'notifications',
  'contracts',
  'sea_time_records',
  'documents',
  'document_files',
  'trip_files',
] as const;

export interface BackupFile {
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: { path: string; data: string }[];
}

export type ProgressFn = (fraction: number) => void;

/** Collects every attached file (photos/PDFs) stored under documents/ and trips/. */
async function collectFilePaths(): Promise<string[]> {
  const paths: string[] = [];
  const roots = [
    `${FileSystem.documentDirectory ?? ''}documents/`,
    `${FileSystem.documentDirectory ?? ''}trips/`,
  ];
  for (const root of roots) {
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists) continue;
    for (const entry of await FileSystem.readDirectoryAsync(root)) {
      const sub = `${root}${entry}`;
      const subInfo = await FileSystem.getInfoAsync(sub);
      if (subInfo.isDirectory) {
        for (const name of await FileSystem.readDirectoryAsync(sub)) {
          paths.push(`${sub}/${name}`);
        }
      } else {
        paths.push(sub);
      }
    }
  }
  return paths;
}

/**
 * Exports the whole app (DB rows + every attached file) into ONE password-
 * protected backup file. Container format: only the small header (metadata +
 * DB tables) is encrypted; photo/PDF payloads are stored as RAW bytes, so
 * huge backups stay fast and light on memory.
 */
export async function createBackup(
  password: string,
  onProgress?: ProgressFn
): Promise<{ count: number; size: number }> {
  const db = await openDatabase();
  const tables: Record<string, Record<string, unknown>[]> = {};
  let count = 0;

  const filePaths = await collectFilePaths();
  const totalSteps = TABLES.length + filePaths.length + 2;
  let step = 0;
  const tick = () => {
    step += 1;
    onProgress?.(Math.min(step / totalSteps, 1));
  };

  for (const table of TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    tables[table] = rows;
    count += rows.length;
    tick();
  }

  // Read every attachment and keep its RAW bytes (no base64 in the header).
  const blobs: Uint8Array[] = [];
  const entries: ContainerFileEntry[] = [];
  let cumulative = 0;
  for (const path of filePaths) {
    const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = base64ToBytes(b64);
    entries.push({
      path: path.replace(FileSystem.documentDirectory ?? '', ''),
      size: bytes.length,
      offset: cumulative,
    });
    cumulative += bytes.length;
    blobs.push(bytes);
    tick();
  }

  const header: ContainerHeader = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    files: entries,
  };
  const containerB64 = buildContainerBytes(header, password, blobs);
  tick();

  const backupPath = `${FileSystem.cacheDirectory ?? ''}seafarers-backup-${Date.now()}.sftk`;
  await FileSystem.writeAsStringAsync(backupPath, containerB64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  tick();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(backupPath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Seafarers Toolkit Backup',
      UTI: 'public.data',
    });
  }
  return { count, size: cumulative };
}

/** Opens the document picker so the user chooses a backup file first. */
export async function pickBackupFile(): Promise<{ uri: string; name: string } | null> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (picked.canceled || picked.assets.length === 0) return null;
  const asset = picked.assets[0];
  return { uri: asset.uri, name: asset.name ?? 'backup' };
}

/**
 * Restores the previously picked backup file (uri from pickBackupFile).
 * Overwrites current data. Supports:
 *  - v2 container (encrypted header + raw blobs, chunked reads)
 *  - legacy v1 single obfuscated JSON (with/without password)
 *  - very old plain-JSON backups
 */
export async function restoreBackup(
  fileUri: string,
  password: string,
  onProgress?: ProgressFn
): Promise<{ count: number; files: number }> {
  const uri = fileUri;
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists && 'size' in info ? Number((info as { size?: number }).size ?? 0) : 0;

  // Peek at the first 2 MB to detect the format.
  const HEAD_CHUNK = 2 * 1024 * 1024;
  const headB64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length: Math.min(size || HEAD_CHUNK, HEAD_CHUNK),
  });
  const headBytes = base64ToBytes(headB64);

  let tables: Record<string, Record<string, unknown>[]>;
  let fileEntries: ContainerFileEntry[] | null = null;
  let legacyFiles: { path: string; data: string }[] = [];
  let dataOffset = 0;

  const parsed = parseContainerHeader(headBytes, password);
  if (parsed) {
    if (parsed.header.version !== BACKUP_VERSION) throw new Error('INVALID_BACKUP');
    tables = parsed.header.tables;
    fileEntries = parsed.header.files;
    dataOffset = parsed.dataOffset;
  } else {
    let legacyParsed: {
      version: number;
      tables: Record<string, Record<string, unknown>[]>;
      files?: { path: string; data: string }[];
    } | null = null;
    if (headBytes.length > 0 && headBytes[0] === 0x7b) {
      const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      try {
        legacyParsed = JSON.parse(text);
      } catch {
        throw new Error('INVALID_BACKUP');
      }
    } else {
      const payloadB64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const codec = require('@/utils/xor-codec') as typeof import('@/utils/xor-codec');
        legacyParsed = JSON.parse(codec.deobfuscateText(payloadB64));
      } catch {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const codec2 = require('@/utils/xor-codec') as typeof import('@/utils/xor-codec');
          legacyParsed = JSON.parse(codec2.deobfuscateWithPassword(payloadB64, password));
        } catch {
          throw new Error('WRONG_PASSWORD');
        }
      }
    }
    if (!legacyParsed || legacyParsed.version !== 1 || !legacyParsed.tables) {
      throw new Error('INVALID_BACKUP');
    }
    tables = legacyParsed.tables;
    legacyFiles = legacyParsed.files ?? [];
  }

  const rowTotal = Object.values(tables).reduce((acc, rows) => acc + rows.length, 0);
  const restoreTargets = fileEntries ? fileEntries.length : legacyFiles.length;
  const totalSteps = rowTotal + restoreTargets + 2;
  let step = 0;
  const tick = () => {
    step += 1;
    onProgress?.(Math.min(step / totalSteps, 1));
  };

  const db = await openDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM trip_files; DELETE FROM document_files; DELETE FROM documents; DELETE FROM sea_time_records; DELETE FROM contracts; DELETE FROM vessels; DELETE FROM notifications; DELETE FROM profile; DELETE FROM ranks; DELETE FROM document_types; DELETE FROM settings;'
    );
    for (const table of INSERT_ORDER) {
      const rows = tables[table] ?? [];
      for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.length === 0) continue;
        const placeholders = keys.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
          ...keys.map((k) => row[k] as string | number | null)
        );
        tick();
      }
    }
  });

  // Restore attachments.
  let restoredFiles = 0;
  if (fileEntries) {
    for (const entry of fileEntries) {
      const absPos = dataOffset + entry.offset;
      // Pass-through: read the RAW blob as base64 and write it out unchanged.
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: absPos,
        length: entry.size,
      });
      await writeBase64File(`${FileSystem.documentDirectory ?? ''}${entry.path}`, b64);
      restoredFiles += 1;
      tick();
    }
  } else {
    for (const file of legacyFiles) {
      await writeBase64File(`${FileSystem.documentDirectory ?? ''}${file.path}`, file.data);
      restoredFiles += 1;
      tick();
    }
  }
  tick();

  return { count: rowTotal, files: restoredFiles };
}

async function writeBase64File(dest: string, data: string): Promise<void> {
  const dir = dest.slice(0, dest.lastIndexOf('/'));
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.writeAsStringAsync(dest, data, { encoding: FileSystem.EncodingType.Base64 });
}
