import { openDatabase } from '../db';
import { documentStatus, daysUntilExpiry } from '@/domain/document-status';
import type { Document, DocumentFile, DocumentType } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

export interface DocumentListRow extends Document {
  typeName: string | null;
  status: ReturnType<typeof documentStatus>;
  daysUntilExpiry: number | null;
}

function mapDocument(row: Record<string, unknown>): Document {
  return {
    id: String(row.id),
    typeId: (row.type_id as string) ?? null,
    name: String(row.name),
    number: (row.number as string) ?? null,
    issueDate: (row.issue_date as string) ?? null,
    expiryDate: (row.expiry_date as string) ?? null,
    issuingAuthority: (row.issuing_authority as string) ?? null,
    issuingCountry: (row.issuing_country as string) ?? null,
    warningThresholdDays: (row.warning_threshold_days as number) ?? null,
    validThresholdDays: (row.valid_threshold_days as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listDocumentTypes(): Promise<DocumentType[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; is_default: number }>(
    'SELECT * FROM document_types ORDER BY is_default DESC, name'
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isDefault: !!r.is_default }));
}

export async function createDocumentType(name: string): Promise<DocumentType> {
  const db = await openDatabase();
  const type: DocumentType = { id: `doctype_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, isDefault: false };
  await db.runAsync(
    'INSERT OR IGNORE INTO document_types (id, name, is_default) VALUES (?, ?, 0)',
    type.id,
    name
  );
  return type;
}

export async function listDocuments(now = new Date()): Promise<DocumentListRow[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT d.*, t.name AS type_name FROM documents d
     LEFT JOIN document_types t ON t.id = d.type_id
     ORDER BY (d.expiry_date IS NULL), d.expiry_date, d.name`
  );
  return rows.map((row) => {
    const doc = mapDocument(row);
    return {
      ...doc,
      typeName: (row.type_name as string) ?? null,
      status: documentStatus(
        {
          expiryDate: doc.expiryDate,
          warningThresholdDays: doc.warningThresholdDays,
          validThresholdDays: doc.validThresholdDays,
        },
        now
      ),
      daysUntilExpiry: doc.expiryDate ? daysUntilExpiry(doc.expiryDate, now) : null,
    };
  });
}

export async function getDocument(id: string): Promise<Document | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM documents WHERE id = ?', id);
  return row ? mapDocument(row) : null;
}

export async function saveDocument(
  input: Omit<Document, 'id' | 'createdAt'> & { id?: string }
): Promise<Document> {
  const db = await openDatabase();
  const id = input.id ?? newId();
  const existing = input.id
    ? await db.getFirstAsync<{ created_at: string }>('SELECT created_at FROM documents WHERE id = ?', id)
    : null;
  await db.runAsync(
    `INSERT INTO documents (id, type_id, name, number, issue_date, expiry_date, issuing_authority, issuing_country, warning_threshold_days, valid_threshold_days, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type_id = excluded.type_id, name = excluded.name, number = excluded.number,
       issue_date = excluded.issue_date, expiry_date = excluded.expiry_date,
       issuing_authority = excluded.issuing_authority, issuing_country = excluded.issuing_country,
       warning_threshold_days = excluded.warning_threshold_days,
       valid_threshold_days = excluded.valid_threshold_days,
       notes = excluded.notes`,
    id,
    input.typeId,
    input.name,
    input.number,
    input.issueDate,
    input.expiryDate,
    input.issuingAuthority,
    input.issuingCountry,
    input.warningThresholdDays,
    input.validThresholdDays,
    input.notes,
    existing?.created_at ?? isoNow()
  );
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM documents WHERE id = ?', id);
  return mapDocument(row!);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
}

function mapFile(row: Record<string, unknown>): DocumentFile {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    localPath: String(row.local_path),
    fileName: String(row.file_name),
    mimeType: (row.mime_type as string) ?? null,
    size: (row.size as number) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function listDocumentFiles(documentId: string): Promise<DocumentFile[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM document_files WHERE document_id = ? ORDER BY created_at',
    documentId
  );
  return rows.map(mapFile);
}

export async function saveDocumentFile(file: Omit<DocumentFile, 'id' | 'createdAt'>): Promise<DocumentFile> {
  const db = await openDatabase();
  const rec: DocumentFile = { ...file, id: newId(), createdAt: isoNow() };
  await db.runAsync(
    'INSERT INTO document_files (id, document_id, local_path, file_name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    rec.id,
    rec.documentId,
    rec.localPath,
    rec.fileName,
    rec.mimeType,
    rec.size,
    rec.createdAt
  );
  return rec;
}

export async function deleteDocumentFile(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM document_files WHERE id = ?', id);
}
