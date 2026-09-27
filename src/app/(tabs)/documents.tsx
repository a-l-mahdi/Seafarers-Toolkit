import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { DocTypeIcon } from '@/components/doc-icon';
import { useDocuments, useDocumentSort, useSaveDocumentSort } from '@/hooks/queries';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useTheme } from '@/hooks/use-theme';
import { resolveDocIcon } from '@/domain/document-icons';
import { Radius, Spacing } from '@/constants/theme';
import { diffInDays } from '@/utils/date';
import type { DocumentListRow } from '@/hooks/queries';
import { useFloatingTabBarPadding } from '@/components/floating-tab-bar';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { showSavedToast } from '@/components/saved-toast';
import { useTabScrollReset, withTabStrip } from '@/components/tab-strip';
import { ReorderDocumentList, SortIcon } from '@/components/document-sort';
import { DEFAULT_DOCUMENT_SORT, nextSortMode, sortDocuments } from '@/domain/document-sort';

const STATUS_TONE = {
  valid: 'success',
  expiring_soon: 'warning',
  not_valid: 'warning',
  expired: 'danger',
  no_expiry: 'muted',
} as const;

type Filter = 'all' | 'valid' | 'expiring' | 'expired';

const matches = (filter: Filter, status: DocumentListRow['status']) =>
  filter === 'all' ||
  (filter === 'valid' && (status === 'valid' || status === 'no_expiry')) ||
  (filter === 'expiring' && (status === 'expiring_soon' || status === 'not_valid')) ||
  (filter === 'expired' && status === 'expired');

/** Bar tone by validity state: yellow below the departure-validity threshold, red at expiry. */
function validityTone(status: DocumentListRow['status']): 'primary' | 'warning' | 'danger' {
  if (status === 'expired') return 'danger';
  if (status === 'not_valid' || status === 'expiring_soon') return 'warning';
  return 'primary';
}

function DocumentsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const scrollRef = useTabScrollReset<FlatList<DocumentListRow>>();
  const router = useRouter();
  const { data: documents, isLoading } = useDocuments();
  const tabPad = useFloatingTabBarPadding();
  const headerPad = useFloatingHeaderPadding();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: sort = DEFAULT_DOCUMENT_SORT } = useDocumentSort();
  const saveSort = useSaveDocumentSort();
  // While arranging by hand: the documents in their starting order, and the order so far.
  const [arranging, setArranging] = useState<DocumentListRow[] | null>(null);
  const draftOrder = useRef<string[]>([]);

  const all = useMemo(() => sortDocuments(documents ?? [], sort), [documents, sort]);

  const onSortPress = () => {
    if (arranging) {
      saveSort.mutate({ mode: 'manual', order: draftOrder.current });
      showSavedToast();
      setArranging(null);
      return;
    }
    const next = nextSortMode(sort.mode);
    if (next !== 'arrange') {
      saveSort.mutate({ mode: next, order: sort.order });
      return;
    }
    // Start from the order last arranged (new documents after it).
    const start = sortDocuments(documents ?? [], { mode: 'manual', order: sort.order });
    draftOrder.current = start.map((d) => d.id);
    setArranging(start);
  };
  const onOrderChange = useCallback((ids: string[]) => {
    draftOrder.current = ids;
  }, []);
  const sortLabel = arranging
    ? t('documents.sort.save')
    : t(
        sort.mode === 'daysDesc'
          ? 'documents.sort.mostDays'
          : sort.mode === 'daysAsc'
            ? 'documents.sort.fewestDays'
            : 'documents.sort.arrange',
      );
  const chips: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: t('documents.filter.all'), color: colors.primary },
    { key: 'valid', label: t('documents.filter.valid'), color: colors.success },
    { key: 'expiring', label: t('documents.filter.expiring'), color: colors.warning },
    { key: 'expired', label: t('documents.filter.expired'), color: colors.danger },
  ];
  const shown = all.filter((d) => matches(filter, d.status));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TelegramHeader
        title={t('documents.title')}
        leading={{
          id: 'sort',
          label: sortLabel,
          filled: !!arranging,
          content: <SortIcon state={arranging ? 'arrange' : sort.mode} color={colors.primary} />,
          onPress: onSortPress,
        }}
        actions={[
          arranging
            ? { id: 'add', icon: 'close', label: t('documents.sort.cancel'), onPress: () => setArranging(null) }
            : { id: 'add', icon: 'add', label: t('common.add'), onPress: () => router.push('/document-form') },
        ]}
      />
      {arranging ? (
        <ReorderDocumentList items={arranging} onOrderChange={onOrderChange} topPad={headerPad} bottomPad={tabPad} />
      ) : (
        <Animated.FlatList
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabPad }]}
          data={shown}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocumentRow item={item} />}
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          ListHeaderComponent={
            all.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {chips.map((c) => {
                  const on = filter === c.key;
                  const count = all.filter((d) => matches(c.key, d.status)).length;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setFilter(c.key)}
                      style={[
                        styles.chip,
                        { backgroundColor: on ? c.color : colors.surface, borderColor: on ? c.color : colors.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: on ? '#FFFFFF' : colors.text }]}>{c.label}</Text>
                      <View style={[styles.chipCount, { backgroundColor: on ? '#FFFFFF33' : `${c.color}1F` }]}>
                        <Text style={[styles.chipCountText, { color: on ? '#FFFFFF' : c.color }]}>{count}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null
          }
          ListEmptyComponent={isLoading ? null : <EmptyState title={t('documents.noDocuments')} />}
        />
      )}
    </View>
  );
}

function DocumentRow({ item }: { item: DocumentListRow }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const formatDate = useFormattedDate();
  // Remaining-validity fraction: daysLeft / (issue → expiry span, or 365 when no issue date).
  const totalValidity =
    item.expiryDate && item.issueDate ? diffInDays(item.issueDate, item.expiryDate) : item.expiryDate ? 365 : 0;
  const validityProgress =
    totalValidity > 0 && item.daysUntilExpiry !== null
      ? Math.min(Math.max(item.daysUntilExpiry / totalValidity, 0), 1)
      : 0;
  return (
    <Link href={`/document-detail?id=${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DocTypeIcon value={resolveDocIcon(item.typeId, item.typeIcon, item.typeColor)} size={48} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Badge label={t(`documents.status.${item.status}`)} tone={STATUS_TONE[item.status]} />
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {item.expiryDate ? formatDate(item.expiryDate) : t('documents.noExpiry')}
              {item.daysUntilExpiry !== null
                ? ` · ${Math.max(item.daysUntilExpiry, 0)} ${t('documents.daysLeft')}`
                : ''}
            </Text>
          </View>
          {item.expiryDate ? <ProgressBar progress={validityProgress} tone={validityTone(item.status)} /> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  chips: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingStart: Spacing.md,
    paddingEnd: 6,
    height: 34,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  chipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipCountText: { fontSize: 12, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  info: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, flexShrink: 1 },
});

export default withTabStrip(DocumentsScreen, 1);
