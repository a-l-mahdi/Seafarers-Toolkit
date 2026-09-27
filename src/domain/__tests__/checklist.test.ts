import { buildChecklistTree, checklistProgress, documentKey, isPacked, leafKeys } from '../checklist';
import type { ChecklistItem } from '@/types/domain';

const item = (id: string, parentId: string | null, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  parentId,
  preset: null,
  name: id,
  quantity: 1,
  sortOrder: 0,
  ...extra,
});

describe('packing checklist', () => {
  const items = [
    item('docs', null, { preset: 'documents', name: null }),
    item('personal', null),
    item('towel', 'personal', { quantity: 2 }),
    item('razor', 'personal'),
    item('photos', 'docs'),
    item('umbrella', null),
  ];
  const documents = [
    { id: 'p', name: 'Passport' },
    { id: 's', name: "Seaman's Book" },
  ];
  const label = (i: ChecklistItem) => i.name ?? `preset:${i.preset}`;

  it('fills the documents group with the user documents, then its own items', () => {
    const [docs] = buildChecklistTree(items, documents, [], label);
    expect(docs.isDocumentsGroup).toBe(true);
    expect(docs.label).toBe('preset:documents');
    expect(docs.children.map((c) => c.key)).toEqual([documentKey('p'), documentKey('s'), 'photos']);
    expect(docs.children[0].isDocument).toBe(true);
  });

  it('treats an entry without sub-items as a single item', () => {
    const tree = buildChecklistTree(items, documents, [], label);
    const umbrella = tree.find((n) => n.key === 'umbrella')!;
    expect(leafKeys(umbrella)).toEqual(['umbrella']);
    expect(leafKeys(tree[1])).toEqual(['towel', 'razor']);
  });

  it('applies trip ticks per column and counts progress over items only', () => {
    const tree = buildChecklistTree(
      items,
      documents,
      [
        { itemKey: 'towel', packedOut: true, packedBack: false },
        { itemKey: 'razor', packedOut: true, packedBack: true },
        { itemKey: documentKey('p'), packedOut: true, packedBack: false },
      ],
      label
    );
    expect(checklistProgress(tree, 'out')).toEqual({ done: 3, total: 6 });
    expect(checklistProgress(tree, 'back')).toEqual({ done: 1, total: 6 });
    expect(isPacked(tree[1], 'out')).toBe(true);
    expect(isPacked(tree[1], 'back')).toBe(false);
    expect(tree[1].children[0].quantity).toBe(2);
  });
});
