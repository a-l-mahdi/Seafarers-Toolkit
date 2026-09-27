import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { ChecklistTree, useChecklistLabel } from '@/components/checklist';
import {
  useChecklistItems,
  useContracts,
  useDocuments,
  useTripChecklist,
  type ContractListRow,
} from '@/hooks/queries';
import { useChecklistEditor } from '@/hooks/use-checklist-editor';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { buildChecklistTree, checklistProgress } from '@/domain/checklist';
import { contractPhase, daysUntilStart } from '@/domain/contract';
import { Spacing } from '@/constants/theme';

/** Main packing list (the template every trip uses) and shortcuts to open trips' checklists. */
export default function ChecklistScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const labelOf = useChecklistLabel();
  const { data: items } = useChecklistItems();
  const { data: documents } = useDocuments();
  const { data: contracts } = useContracts();
  const editor = useChecklistEditor(items ?? []);

  const nodes = buildChecklistTree(
    items ?? [],
    (documents ?? []).map((d) => ({ id: d.id, name: d.name })),
    [],
    labelOf
  );
  const trips = [...(contracts ?? [])]
    .filter((c) => !c.actualSignOff)
    .sort((a, b) => (a.joinDate < b.joinDate ? -1 : 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={t('checklist.title')}
        onBack={() => router.back()}
        actions={[{ icon: 'add', label: t('checklist.addItem'), onPress: () => editor.openAdd(null) }]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
      >
        {trips.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.textMuted }]}>{t('checklist.trips')}</Text>
            {trips.map((c) => (
              <TripCard key={c.id} contract={c} />
            ))}
            <Text style={[styles.section, { color: colors.textMuted, marginTop: Spacing.sm }]}>{t('checklist.items')}</Text>
          </>
        ) : null}
        <ChecklistTree
          nodes={nodes}
          mode="template"
          onEdit={editor.openEdit}
          onAddChild={(node) => editor.openAdd(node.itemId)}
        />
      </ScrollView>
      {editor.modal}
    </View>
  );
}

function TripCard({ contract }: { contract: ContractListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const router = useRouter();
  const labelOf = useChecklistLabel();
  const { data: items } = useChecklistItems();
  const { data: documents } = useDocuments();
  const { data: marks } = useTripChecklist(contract.id);

  const phase = contractPhase(contract);
  const column = phase === 'upcoming' ? 'out' : 'back';
  const nodes = buildChecklistTree(
    items ?? [],
    (documents ?? []).map((d) => ({ id: d.id, name: d.name })),
    marks ?? [],
    labelOf
  );
  const progress = checklistProgress(nodes, column);
  const pct = progress.total > 0 ? progress.done / progress.total : 0;
  const toStart = daysUntilStart(contract);
  const status =
    phase === 'upcoming'
      ? toStart <= 1
        ? t('contracts.startsTomorrow')
        : t('contracts.startsIn', { days: toStart })
      : t('contracts.active');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip-checklist', params: { id: contract.id } })}
      android_ripple={{ color: ocean.soft }}
      style={[styles.trip, { backgroundColor: colors.surface, borderColor: ocean.line }]}
    >
      <View style={[styles.tripIcon, { backgroundColor: ocean.main }]}>
        <Ionicons name={phase === 'upcoming' ? 'airplane' : 'home'} size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.tripHead}>
          <Text style={[styles.tripTitle, { color: colors.text }]} numberOfLines={1}>
            {contract.vesselName ?? '—'}
          </Text>
          <Text style={[styles.tripCount, { color: ocean.main }]}>
            {t('checklist.progress', { done: progress.done, total: progress.total })}
          </Text>
        </View>
        <Text style={[styles.tripStatus, { color: colors.textMuted }]} numberOfLines={1}>
          {status} · {t(column === 'out' ? 'checklist.out' : 'checklist.back')}
        </Text>
        <View style={[styles.track, { backgroundColor: ocean.mist }]}>
          <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ocean.main }]} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  section: { fontSize: 13, fontWeight: '700', marginBottom: -Spacing.xs, marginHorizontal: Spacing.xs },
  trip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  tripIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tripHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tripTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  tripCount: { fontSize: 12, fontWeight: '800' },
  tripStatus: { fontSize: 12 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3 },
});
