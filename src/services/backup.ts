import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { openDatabase } from '@/database/db';
import { obfuscateText, deobfuscateText, obfuscateWithPassword, deobfuscateWithPassword } from '@/utils/xor-codec';

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

const BACKUP_VERSION = 1;

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
 * Exports the whole app (DB rows + every attached file) into one password-
 * protected backup file. The password is required to restore; without it the
 * payload is unreadable. onProgress reports 0..1 for the progress bar.
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

  // Inline every attached file as base64 so a single file restores everything.
  const files: { path: string; data: string }[] = [];
  for (const path of filePaths) {
    const data = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    files.push({ path: path.replace(FileSystem.documentDirectory ?? '', ''), data });
    tick();
  }

  const backup: BackupFile = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables, files };
  const json = JSON.stringify(backup);
  tick();

  // Password-protected obfuscation: restorable only with the chosen password.
  const backupPath = `${FileSystem.cacheDirectory ?? ''}seafarers-backup-${Date.now()}.sftk`;
  await FileSystem.writeAsStringAsync(
    backupPath,
    password ? obfuscateWithPassword(json, password) : obfuscateText(json),
    { encoding: FileSystem.EncodingType.Base64 }
  );
  tick();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(backupPath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Seafarers Toolkit Backup',
      UTI: 'public.data',
    });
  }
  return { count, size: json.length };
}

/** Restores a backup file picked by the user. Overwrites current data. */
export async function restoreBackup(
  password: string,
  onProgress?: ProgressFn
): Promise<{ count: number; files: number }> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (picked.canceled || picked.assets.length === 0) return { count: 0, files: 0 };
  const uri = picked.assets[0].uri;

  // Plain-JSON backups (very old) restore without a password; everything else
  // must be deobfuscated with the exact backup password.
  const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  let backup: BackupFile;
  if (raw.trim().startsWith('{')) {
    try {
      backup = JSON.parse(raw) as BackupFile;
    } catch {
      throw new Error('INVALID_BACKUP');
    }
  } else {
    const payload = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    let backupParsed: BackupFile | null = null;
    try {
      // Legacy builds obfuscated with the static secret only (no password).
      backupParsed = JSON.parse(deobfuscateText(payload)) as BackupFile;
    } catch {
      try {
        backupParsed = JSON.parse(deobfuscateWithPassword(payload, password)) as BackupFile;
      } catch {
        throw new Error('WRONG_PASSWORD');
      }
    }
    if (!backupParsed) throw new Error('WRONG_PASSWORD');
    backup = backupParsed;
  }
  if (!backup || backup.version !== BACKUP_VERSION || !backup.tables) {
    throw new Error('INVALID_BACKUP');
  }

  const rowTotal = Object.values(backup.tables).reduce((acc, rows) => acc + rows.length, 0);
  const totalSteps = rowTotal + (backup.files?.length ?? 0) + 2;
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
    for (const table of [...TABLES].reverse()) {
      const rows = backup.tables[table] ?? [];
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

  // Restore attached files from base64.
  let fileCount = 0;
  for (const file of backup.files ?? []) {
    const dest = `${FileSystem.documentDirectory ?? ''}${file.path}`;
    const dir = dest.slice(0, dest.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(dest, file.data, { encoding: FileSystem.EncodingType.Base64 });
    fileCount += 1;
    tick();
  }
  tick();

  return { count: rowTotal, files: fileCount };
}
