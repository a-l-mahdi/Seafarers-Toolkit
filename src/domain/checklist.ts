import type { ChecklistItem, TripChecklistMark } from '@/types/domain';

/** Preset of the group whose items are the user's own documents. */
export const DOCUMENTS_PRESET = 'documents';

export type ChecklistColumn = 'out' | 'back';

export interface ChecklistNode {
  /** Tick key: the template item id, or `doc:<documentId>` for a document. */
  key: string;
  /** Template row id (null for entries derived from documents). */
  itemId: string | null;
  label: string;
  quantity: number;
  isDocument: boolean;
  isDocumentsGroup: boolean;
  /** Sub-items; an entry without any is a single tickable item. */
  children: ChecklistNode[];
  packedOut: boolean;
  packedBack: boolean;
}

export const documentKey = (documentId: string) => `doc:${documentId}`;

/**
 * Builds the checklist tree from the template, filling the documents group with
 * the user's documents (kept in sync automatically) and applying one trip's ticks.
 */
export function buildChecklistTree(
  items: ChecklistItem[],
  documents: { id: string; name: string }[],
  marks: TripChecklistMark[],
  labelOf: (item: ChecklistItem) => string
): ChecklistNode[] {
  const markBy = new Map(marks.map((m) => [m.itemKey, m]));
  const byParent = new Map<string | null, ChecklistItem[]>();
  for (const item of items) {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  }

  const leaf = (key: string, itemId: string | null, label: string, quantity: number, isDocument: boolean): ChecklistNode => {
    const mark = markBy.get(key);
    return {
      key,
      itemId,
      label,
      quantity,
      isDocument,
      isDocumentsGroup: false,
      children: [],
      packedOut: mark?.packedOut ?? false,
      packedBack: mark?.packedBack ?? false,
    };
  };

  const build = (item: ChecklistItem, depth: number): ChecklistNode => {
    const node = leaf(item.id, item.id, labelOf(item), item.quantity, false);
    const isDocs = item.preset === DOCUMENTS_PRESET;
    const children: ChecklistNode[] = [];
    if (isDocs) {
      for (const doc of documents) children.push(leaf(documentKey(doc.id), null, doc.name, 1, true));
    }
    if (depth < 4) {
      for (const child of byParent.get(item.id) ?? []) children.push(build(child, depth + 1));
    }
    return { ...node, isDocumentsGroup: isDocs, children };
  };

  return (byParent.get(null) ?? []).map((item) => build(item, 0));
}

/** Tick keys of every item at the bottom of the node (the node itself if it has no children). */
export function leafKeys(node: ChecklistNode): string[] {
  if (node.children.length === 0) return [node.key];
  return node.children.flatMap(leafKeys);
}

function leaves(node: ChecklistNode): ChecklistNode[] {
  return node.children.length === 0 ? [node] : node.children.flatMap(leaves);
}

export interface ChecklistProgress {
  done: number;
  total: number;
}

/** Packed vs. total items for one column, over the given nodes. */
export function checklistProgress(nodes: ChecklistNode[], column: ChecklistColumn): ChecklistProgress {
  const all = nodes.flatMap(leaves);
  const done = all.filter((n) => (column === 'out' ? n.packedOut : n.packedBack)).length;
  return { done, total: all.length };
}

/** Whether every item under the node is packed for the column. */
export function isPacked(node: ChecklistNode, column: ChecklistColumn): boolean {
  const p = checklistProgress([node], column);
  return p.total > 0 && p.done === p.total;
}
