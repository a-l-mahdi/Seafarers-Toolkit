import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import type { ReadyFile } from '@/services/file-share';
import { openDatabase } from '@/database/db';
import { base64ToBytes } from '@/utils/xor-codec';
import {
  buildContainerBytes,
  parseContainerHeader,
  type ContainerFileEntry,
  type ContainerHeader,
} from '@/utils/backup-container';

// NOTE: `notifications` is intentionally NOT backed up. Notifications are derived
// state (raised/read/deleted status is transient). After a restore they are
// regenerated fresh from the restored documents, so a needed alert always shows
// even if it had been read or deleted in the source app.
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
  'settings',
] as const;

const BACKUP_VERSION = 2;

/** App-level preferences (language/theme/calendar) that live in SecureStore,
 *  included in the backup so they come back after a restore. */
export interface BackupAppSettings {
  locale: string;
  theme: string;
  calendar: string;
}

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

/** Top-level folders under the document directory that must NOT be backed up as
 *  raw files: the SQLite database is captured as table rows instead. */
const SKIP_TOP_DIRS = new Set(['SQLite']);

/**
 * Collects EVERY user file under the app's document directory (document scans,
 * trip files, profile photos, anything the user attaches), recursively — so a
 * backup is complete regardless of which sub-folder a feature stored it in.
 * The SQLite folder is skipped (its data travels as table rows).
 */
async function collectFilePaths(): Promise<string[]> {
  const root = FileSystem.documentDirectory ?? '';
  if (!root) return [];
  const paths: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let names: string[];
    try {
      names = await FileSystem.readDirectoryAsync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = `${dir}${name}`;
      const info = await FileSystem.getInfoAsync(full);
      if (info.isDirectory) {
        if (dir === root && SKIP_TOP_DIRS.has(name)) continue;
        await walk(`${full}/`);
      } else {
        paths.push(full);
      }
    }
  };
  await walk(root);
  return paths;
}

/**
 * After a restore the DB rows carry the absolute paths they had when the backup
 * was made (which include the *old* app sandbox / package). Rebase every stored
 * file path onto the CURRENT document directory so attachments resolve even
 * after a reinstall, a different device, or the package rename.
 */
async function normalizeRestoredPaths(
  db: Awaited<ReturnType<typeof openDatabase>>
): Promise<void> {
  const docDir = FileSystem.documentDirectory ?? '';
  if (!docDir) return;
  const rebase = (p: string | null): string | null => {
    if (!p || typeof p !== 'string') return p;
    const marker = '/files/';
    const i = p.lastIndexOf(marker);
    if (i >= 0) return `${docDir}${p.slice(i + marker.length)}`;
    for (const m of ['documents/', 'trips/', 'photos/']) {
      const j = p.indexOf(m);
      if (j >= 0) return `${docDir}${p.slice(j)}`;
    }
    return p;
  };

  for (const table of ['document_files', 'trip_files'] as const) {
    const rows = await db.getAllAsync<{ id: string; local_path: string | null }>(
      `SELECT id, local_path FROM ${table}`
    );
    for (const row of rows) {
      const next = rebase(row.local_path);
      if (next && next !== row.local_path) {
        await db.runAsync(`UPDATE ${table} SET local_path = ? WHERE id = ?`, next, row.id);
      }
    }
  }

  const profiles = await db.getAllAsync<{ id: string; photo_path: string | null }>(
    'SELECT id, photo_path FROM profile'
  );
  for (const row of profiles) {
    const next = rebase(row.photo_path);
    if (next && next !== row.photo_path) {
      await db.runAsync('UPDATE profile SET photo_path = ? WHERE id = ?', next, row.id);
    }
  }
}

/**
 * Exports the whole app (DB rows + every attached file) into ONE password-
 * protected backup file. Container format: only the small header (metadata +
 * DB tables) is encrypted; photo/PDF payloads are stored as RAW bytes, so
 * huge backups stay fast and light on memory.
 */
export async function createBackup(
  password: string,
  onProgress?: ProgressFn,
  appSettings?: BackupAppSettings
): Promise<{ count: number; size: number; file: ReadyFile }> {
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
    appSettings: appSettings ?? null,
  };
  const containerB64 = buildContainerBytes(header, password, blobs);
  tick();

  const backupPath = `${FileSystem.cacheDirectory ?? ''}seafarers-backup-${Date.now()}.sftk`;
  await FileSystem.writeAsStringAsync(backupPath, containerB64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  tick();
  return {
    count,
    size: cumulative,
    file: { uri: backupPath, name: 'seafarers-backup.sftk', mime: 'application/octet-stream' },
  };
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
): Promise<{ count: number; files: number; appSettings: BackupAppSettings | null }> {
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
  let appSettings: BackupAppSettings | null = null;
  if (parsed) {
    if (parsed.header.version !== BACKUP_VERSION) throw new Error('INVALID_BACKUP');
    tables = parsed.header.tables;
    fileEntries = parsed.header.files;
    dataOffset = parsed.dataOffset;
    appSettings = parsed.header.appSettings ?? null;
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

  // Point the restored DB rows at the current document directory.
  await normalizeRestoredPaths(db);
  tick();

  return { count: rowTotal, files: restoredFiles, appSettings };
}

async function writeBase64File(dest: string, data: string): Promise<void> {
  const dir = dest.slice(0, dest.lastIndexOf('/'));
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.writeAsStringAsync(dest, data, { encoding: FileSystem.EncodingType.Base64 });
}
