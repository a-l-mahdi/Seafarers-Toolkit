import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { openDatabase } from '@/database/db';

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

/** Exports the whole app (DB rows + attached files) into one local JSON backup. */
export async function createBackup(): Promise<{ count: number; size: number }> {
  const db = await openDatabase();
  const tables: Record<string, Record<string, unknown>[]> = {};
  let count = 0;

  for (const table of TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    tables[table] = rows;
    count += rows.length;
  }

  // Inline every attached file as base64 so a single JSON restores everything.
  const files: { path: string; data: string }[] = [];
  const roots = [
    `${FileSystem.documentDirectory ?? ''}documents/`,
    `${FileSystem.documentDirectory ?? ''}trips/`,
  ];
  for (const root of roots) {
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists) continue;
    const entries = await FileSystem.readDirectoryAsync(root);
    for (const entry of entries) {
      const sub = `${root}${entry}`;
      const subInfo = await FileSystem.getInfoAsync(sub);
      if (subInfo.isDirectory) {
        for (const name of await FileSystem.readDirectoryAsync(sub)) {
          files.push(await readBase64(`${sub}/${name}`));
        }
      } else {
        files.push(await readBase64(sub));
      }
    }
  }

  const backup: BackupFile = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables, files };
  const json = JSON.stringify(backup);

  // Offer a share/save sheet so the user can keep the file anywhere (even SD card).
  const backupPath = `${FileSystem.cacheDirectory ?? ''}seafarers-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(backupPath, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(backupPath, {
      mimeType: 'application/json',
      dialogTitle: 'Seafarers Toolkit Backup',
      UTI: 'public.json',
    });
  }
  return { count, size: json.length };
}

async function readBase64(path: string): Promise<{ path: string; data: string }> {
  const data = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
  const relative = path.replace(FileSystem.documentDirectory ?? '', '');
  return { path: relative, data };
}

/** Restores a backup file picked by the user. Overwrites current data. */
export async function restoreBackup(): Promise<{ count: number; files: number }> {
  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (picked.canceled || picked.assets.length === 0) return { count: 0, files: 0 };
  const uri = picked.assets[0].uri;

  const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const backup = JSON.parse(json) as BackupFile;
  if (!backup || backup.version !== BACKUP_VERSION || !backup.tables) {
    throw new Error('INVALID_BACKUP');
  }

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
  }

  return { count: Object.values(backup.tables).reduce((acc, rows) => acc + rows.length, 0), files: fileCount };
}
