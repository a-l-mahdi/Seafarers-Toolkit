import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChecklistItemModal, useChecklistLabel, type ChecklistEditorTarget } from '@/components/checklist';
import { DOCUMENTS_PRESET, type ChecklistNode } from '@/domain/checklist';
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
  type ChecklistItem,
} from '@/hooks/queries';

/**
 * Add / edit / delete for the checklist, shared by the main list and trip
 * checklists (both edit the same main list). Returns openers and the popup.
 */
export function useChecklistEditor(items: ChecklistItem[]) {
  const { t } = useTranslation();
  const labelOf = useChecklistLabel();
  const add = useAddChecklistItem();
  const update = useUpdateChecklistItem();
  const remove = useDeleteChecklistItem();
  const [target, setTarget] = useState<ChecklistEditorTarget | null>(null);

  const groups = items.filter((i) => i.parentId === null).map((i) => ({ id: i.id, label: labelOf(i) }));

  const openAdd = (parentId: string | null = null) => setTarget({ kind: 'add', parentId });

  const openEdit = (node: ChecklistNode) => {
    const item = items.find((i) => i.id === node.itemId);
    if (!item) return;
    setTarget({
      kind: 'edit',
      itemId: item.id,
      name: labelOf(item),
      quantity: item.quantity,
      isGroup: node.children.length > 0 || node.isDocumentsGroup,
      deletable: item.preset !== DOCUMENTS_PRESET,
    });
  };

  const close = () => setTarget(null);

  const submit = ({ name, quantity, parentId }: { name: string; quantity: number; parentId: string | null }) => {
    if (!target) return;
    if (target.kind === 'add') {
      add.mutate({ name, quantity, parentId });
    } else {
      const item = items.find((i) => i.id === target.itemId);
      // An unchanged built-in label stays translatable.
      const keepPreset = !!item?.preset && item.name === null && name === labelOf(item);
      update.mutate({ id: target.itemId, name: keepPreset ? null : name, quantity });
    }
    close();
  };

  const confirmDelete = () => {
    if (!target || target.kind !== 'edit') return;
    const { itemId, name, isGroup } = target;
    Alert.alert(
      t('common.delete'),
      t(isGroup ? 'checklist.deleteGroupConfirm' : 'checklist.deleteConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            remove.mutate(itemId);
            close();
          },
        },
      ]
    );
  };

  const modal = (
    <ChecklistItemModal target={target} groups={groups} onClose={close} onSubmit={submit} onDelete={confirmDelete} />
  );

  return { openAdd, openEdit, modal };
}
