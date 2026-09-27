import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { ChecklistHero, ChecklistTree, ColumnHeader, useChecklistLabel } from '@/components/checklist';
import {
  useChecklistItems,
  useContracts,
  useDocuments,
  useSetTripChecklistMarks,
  useTripChecklist,
  type ContractListRow,
} from '@/hooks/queries';
import { useChecklistEditor } from '@/hooks/use-checklist-editor';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { buildChecklistTree, checklistProgress, leafKeys, type ChecklistColumn } from '@/domain/checklist';
import { contractPhase, daysUntilStart } from '@/domain/contract';
import { Spacing } from '@/constants/theme';

export default function TripChecklistScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: contracts } = useContracts();
  const { data: items } = useChecklistItems();
  const contract = contracts?.find((c) => c.id === id) ?? null;
  // A trip's checklist lives from the day the contract is added until sign-off.
  const available = !!contract && !contract.actualSignOff;
  const editor = useChecklistEditor(items ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={t('checklist.title')}
        onBack={() => router.back()}
        actions={available ? [{ icon: 'add', label: t('checklist.addItem'), onPress: () => editor.openAdd(null) }] : []}
      />
      {available && contract ? (
        <TripChecklistBody contract={contract} onEdit={editor.openEdit} />
      ) : (
        <EmptyState title={t('contracts.notFound')} />
      )}
      {editor.modal}
    </View>
  );
}

function TripChecklistBody({
  contract,
  onEdit,
}: {
  contract: ContractListRow;
  onEdit: ReturnType<typeof useChecklistEditor>['openEdit'];
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const formatDate = useFormattedDate();
  const labelOf = useChecklistLabel();
  const { data: items } = useChecklistItems();
  const { data: documents } = useDocuments();
  const { data: marks } = useTripChecklist(contract.id);
  const setMarks = useSetTripChecklistMarks(contract.id);

  const nodes = buildChecklistTree(
    items ?? [],
    (documents ?? []).map((d) => ({ id: d.id, name: d.name })),
    marks ?? [],
    labelOf
  );
  const phase = contractPhase(contract);
  // The "packed for home" column opens once the trip has started.
  const columns: ChecklistColumn[] = phase === 'upcoming' ? ['out'] : ['out', 'back'];
  const primary: ChecklistColumn = phase === 'upcoming' ? 'out' : 'back';
  const toStart = daysUntilStart(contract);

  const subtitle =
    phase === 'upcoming'
      ? toStart <= 1
        ? t('contracts.startsTomorrow')
        : t('contracts.startsIn', { days: toStart })
      : `${formatDate(contract.joinDate)} → ${formatDate(contract.expectedSignOff)}`;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
    >
      <ChecklistHero
        title={contract.vesselName ?? '—'}
        subtitle={subtitle}
        badge={t(phase === 'upcoming' ? 'contracts.planned' : 'contracts.active')}
        rings={columns.map((column) => ({
          column,
          label: t(column === 'out' ? 'checklist.out' : 'checklist.back'),
          progress: checklistProgress(nodes, column),
        }))}
      />
      <ColumnHeader columns={columns} />
      <ChecklistTree
        nodes={nodes}
        mode="trip"
        columns={columns}
        primaryColumn={primary}
        onToggle={(node, column, packed) => setMarks.mutate({ itemKeys: leafKeys(node), column, packed })}
        onEdit={onEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
});
