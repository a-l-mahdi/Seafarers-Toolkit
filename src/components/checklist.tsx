import { useId, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useOcean, useTheme } from '@/hooks/use-theme';
import { showSavedToast } from '@/components/saved-toast';
import { Radius, Spacing } from '@/constants/theme';
import {
  checklistProgress,
  type ChecklistColumn,
  type ChecklistNode,
  type ChecklistProgress,
} from '@/domain/checklist';
import type { ChecklistItem } from '@/types/domain';

type IconName = keyof typeof Ionicons.glyphMap;

/** Translated label of a template row (user name, else the built-in preset label). */
export function useChecklistLabel() {
  const { t } = useTranslation();
  return (item: ChecklistItem) => item.name ?? (item.preset ? t(`checklist.presets.${item.preset}` as never) : '—');
}

export const COLUMN_ICON: Record<ChecklistColumn, IconName> = { out: 'airplane', back: 'home' };

// --- hero -----------------------------------------------------------------

/** Ocean gradient with a soft wave along the bottom. */
function OceanBackdrop({ width, height }: { width: number; height: number }) {
  const ocean = useOcean();
  const id = `ocean-${useId().replace(/:/g, '')}`;
  const w = width;
  const h = height;
  const wave = `M0,${h - 26} C${w * 0.25},${h - 44} ${w * 0.45},${h - 8} ${w * 0.7},${h - 24} S${w},${h - 30} ${w},${h - 30} L${w},${h} L0,${h} Z`;
  const wave2 = `M0,${h - 14} C${w * 0.3},${h - 30} ${w * 0.55},${h} ${w * 0.8},${h - 14} S${w},${h - 16} ${w},${h - 16} L${w},${h} L0,${h} Z`;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ocean.deep} />
          <Stop offset="1" stopColor="#0096C7" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      <Path d={wave} fill="#FFFFFF" opacity={0.08} />
      <Path d={wave2} fill="#FFFFFF" opacity={0.1} />
    </Svg>
  );
}

function ProgressRing({
  progress,
  size = 60,
  icon,
  label,
}: {
  progress: ChecklistProgress;
  size?: number;
  icon: IconName;
  label: string;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = progress.total > 0 ? progress.done / progress.total : 0;
  return (
    <View style={heroStyles.ringWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#FFFFFF"
            strokeOpacity={0.22}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#FFFFFF"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - fraction)}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, heroStyles.ringCenter]}>
          <Ionicons name={fraction >= 1 ? 'checkmark' : icon} size={20} color="#FFFFFF" />
        </View>
      </View>
      <Text style={heroStyles.ringLabel}>{label}</Text>
      <Text style={heroStyles.ringValue}>
        {progress.done}/{progress.total}
      </Text>
    </View>
  );
}

/** Top card of a trip checklist: vessel, where the trip stands, packing rings. */
export function ChecklistHero({
  title,
  subtitle,
  badge,
  rings,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  rings: { column: ChecklistColumn; label: string; progress: ChecklistProgress }[];
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={heroStyles.card}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? <OceanBackdrop width={size.w} height={size.h} /> : null}
      <View style={heroStyles.body}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={heroStyles.iconBubble}>
            <Ionicons name="boat" size={20} color="#FFFFFF" />
          </View>
          <Text style={heroStyles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={heroStyles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
          {badge ? (
            <View style={heroStyles.badge}>
              <Text style={heroStyles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={heroStyles.rings}>
          {rings.map((ring) => (
            <ProgressRing
              key={ring.column}
              progress={ring.progress}
              icon={COLUMN_ICON[ring.column]}
              label={ring.label}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', minHeight: 150 },
  body: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.md },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#FFFFFFD9', fontSize: 13, fontWeight: '500' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  badgeText: { color: '#0077B6', fontSize: 11, fontWeight: '800' },
  rings: { flexDirection: 'row', gap: Spacing.md },
  ringWrap: { alignItems: 'center', gap: 2 },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringLabel: { color: '#FFFFFFD9', fontSize: 11, fontWeight: '600', marginTop: 4 },
  ringValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

// --- ticks ----------------------------------------------------------------

export const CELL_WIDTH = 50;
/** Row end padding so a tick circle sits Spacing.md from the card edge. */
const TICK_EDGE = Spacing.md - (CELL_WIDTH - 30) / 2;

type TickState = 'all' | 'some' | 'none';

function tickState(node: ChecklistNode, column: ChecklistColumn): TickState {
  const p = checklistProgress([node], column);
  if (p.total > 0 && p.done === p.total) return 'all';
  return p.done > 0 ? 'some' : 'none';
}

/** ✓ packed / ✕ not yet; a group shows a dash while only part of it is packed. */
function TickCell({ state, onPress, label }: { state: TickState; onPress: () => void; label: string }) {
  const colors = useTheme();
  const ocean = useOcean();
  return (
    <View style={tickStyles.cell}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: state === 'all' ? true : state === 'some' ? 'mixed' : false }}
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          tickStyles.circle,
          state === 'all'
            ? { backgroundColor: ocean.main, borderColor: ocean.main }
            : state === 'some'
              ? { borderColor: ocean.main, backgroundColor: ocean.mist }
              : { borderColor: colors.border, backgroundColor: colors.surface },
          { transform: [{ scale: pressed ? 0.88 : 1 }] },
        ]}
      >
        <Animated.View key={state} entering={ZoomIn.duration(180)}>
          <Ionicons
            name={state === 'all' ? 'checkmark' : state === 'some' ? 'remove' : 'close'}
            size={state === 'all' ? 18 : 15}
            color={state === 'all' ? '#FFFFFF' : state === 'some' ? ocean.main : colors.textMuted}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const tickStyles = StyleSheet.create({
  cell: { width: CELL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Column captions (رفت / برگشت) lined up above the tick cells. */
export function ColumnHeader({ columns }: { columns: ChecklistColumn[] }) {
  const { t } = useTranslation();
  const ocean = useOcean();
  return (
    <View style={treeStyles.columnHeader}>
      <View style={{ flex: 1 }} />
      {columns.map((col) => (
        <View key={col} style={[tickStyles.cell, { gap: 2 }]}>
          <Ionicons name={COLUMN_ICON[col]} size={14} color={ocean.main} />
          <Text style={[treeStyles.columnText, { color: ocean.main }]}>
            {t(col === 'out' ? 'checklist.out' : 'checklist.back')}
          </Text>
        </View>
      ))}
    </View>
  );
}

// --- tree -----------------------------------------------------------------

function groupIcon(node: ChecklistNode): IconName {
  if (node.isDocumentsGroup) return 'folder-open';
  if (node.itemId === 'chk_personal') return 'bag-handle';
  return node.children.length > 0 ? 'albums' : 'cube';
}

function QuantityChip({ quantity }: { quantity: number }) {
  const ocean = useOcean();
  if (quantity <= 1) return null;
  return (
    <View style={[treeStyles.qty, { backgroundColor: ocean.mist, borderColor: ocean.line }]}>
      <Text style={[treeStyles.qtyText, { color: ocean.main }]}>×{quantity}</Text>
    </View>
  );
}

function MiniBar({ progress }: { progress: ChecklistProgress }) {
  const colors = useTheme();
  const ocean = useOcean();
  const pct = progress.total > 0 ? progress.done / progress.total : 0;
  return (
    <View style={[treeStyles.bar, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[treeStyles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ocean.main }]} />
    </View>
  );
}

export interface ChecklistTreeProps {
  nodes: ChecklistNode[];
  /** 'trip' shows tick columns; 'template' edits the list itself. */
  mode: 'trip' | 'template';
  columns?: ChecklistColumn[];
  /** Column whose progress shows under each group name. */
  primaryColumn?: ChecklistColumn;
  onToggle?: (node: ChecklistNode, column: ChecklistColumn, packed: boolean) => void;
  onEdit?: (node: ChecklistNode) => void;
  onAddChild?: (node: ChecklistNode) => void;
}

/** Accordion checklist: each group is a card that opens onto its items. */
export function ChecklistTree({
  nodes,
  mode,
  columns = [],
  primaryColumn = 'out',
  onToggle,
  onEdit,
  onAddChild,
}: ChecklistTreeProps) {
  // Until the user opens or closes a group, the first one starts open.
  const [open, setOpen] = useState<Set<string> | null>(null);
  const openSet = open ?? new Set(nodes[0] ? [nodes[0].key] : []);
  const toggleOpen = (key: string) =>
    setOpen(() => {
      const next = new Set(openSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <View style={{ gap: Spacing.md }}>
      {nodes.map((node, i) => (
        <Animated.View
          key={node.key}
          entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(260)}
          layout={LinearTransition.duration(200)}
        >
          <GroupCard
            node={node}
            mode={mode}
            columns={columns}
            primaryColumn={primaryColumn}
            expanded={openSet.has(node.key)}
            onToggleOpen={() => toggleOpen(node.key)}
            onToggle={onToggle}
            onEdit={onEdit}
            onAddChild={onAddChild}
          />
        </Animated.View>
      ))}
    </View>
  );
}

function RowShell({
  children,
  indent,
  ticks,
  onPress,
  onLongPress,
}: {
  children: ReactNode;
  indent?: boolean;
  /** Row ends in tick cells (they carry their own side spacing). */
  ticks?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const ocean = useOcean();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      android_ripple={{ color: ocean.soft }}
      style={[treeStyles.row, ticks && treeStyles.rowTicks, indent && treeStyles.indent]}
    >
      {children}
    </Pressable>
  );
}

function GroupCard({
  node,
  mode,
  columns,
  primaryColumn,
  expanded,
  onToggleOpen,
  onToggle,
  onEdit,
  onAddChild,
}: Omit<ChecklistTreeProps, 'nodes'> & {
  node: ChecklistNode;
  columns: ChecklistColumn[];
  primaryColumn: ChecklistColumn;
  expanded: boolean;
  onToggleOpen: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const isGroup = node.children.length > 0;
  const progress = checklistProgress([node], primaryColumn);
  const editable = mode === 'template' && !!node.itemId;

  const ticks = (n: ChecklistNode) =>
    mode === 'trip'
      ? columns.map((col) => {
          const state = tickState(n, col);
          return (
            <TickCell
              key={col}
              state={state}
              label={`${n.label} · ${t(col === 'out' ? 'checklist.out' : 'checklist.back')}`}
              onPress={() => onToggle?.(n, col, state !== 'all')}
            />
          );
        })
      : null;

  const header = (
    <RowShell
      ticks={mode === 'trip'}
      onPress={isGroup ? onToggleOpen : editable ? () => onEdit?.(node) : undefined}
      onLongPress={mode === 'trip' && node.itemId ? () => onEdit?.(node) : undefined}
    >
      <View style={[treeStyles.groupIcon, { backgroundColor: ocean.mist }]}>
        <Ionicons name={groupIcon(node)} size={18} color={ocean.main} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={treeStyles.titleLine}>
          <Text style={[treeStyles.groupTitle, { color: colors.text }]} numberOfLines={1}>
            {node.label}
          </Text>
          {!isGroup ? <QuantityChip quantity={node.quantity} /> : null}
        </View>
        {isGroup ? (
          mode === 'trip' ? (
            <View style={treeStyles.progressLine}>
              <MiniBar progress={progress} />
              <Text style={[treeStyles.progressText, { color: colors.textMuted }]}>
                {t('checklist.progress', { done: progress.done, total: progress.total })}
              </Text>
            </View>
          ) : (
            <Text style={[treeStyles.progressText, { color: colors.textMuted }]}>
              {t('checklist.count', { count: node.children.length })}
            </Text>
          )
        ) : null}
      </View>
      {mode === 'template' ? (
        <>
          {isGroup && editable && !node.isDocumentsGroup ? (
            <SmallIcon
              icon="create-outline"
              color={colors.textMuted}
              label={t('checklist.editItem')}
              onPress={() => onEdit?.(node)}
            />
          ) : null}
          <SmallIcon
            icon="add"
            color={ocean.main}
            filled
            label={t('checklist.addItem')}
            onPress={() => onAddChild?.(node)}
          />
        </>
      ) : null}
      {isGroup ? (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
          style={treeStyles.chevron}
        />
      ) : null}
      {ticks(node)}
    </RowShell>
  );

  return (
    <View style={[treeStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {header}
      {isGroup && expanded ? (
        <Animated.View entering={FadeIn.duration(180)}>
          {node.children.map((child) => {
            const childEditable = !!child.itemId;
            return (
              <View key={child.key} style={[treeStyles.childWrap, { borderTopColor: colors.border }]}>
                <RowShell
                  indent
                  ticks={mode === 'trip'}
                  onPress={mode === 'template' && childEditable ? () => onEdit?.(child) : undefined}
                  onLongPress={mode === 'trip' && childEditable ? () => onEdit?.(child) : undefined}
                >
                  <Ionicons
                    name={child.isDocument ? 'document-text-outline' : 'ellipse'}
                    size={child.isDocument ? 17 : 7}
                    color={child.isDocument ? ocean.main : ocean.bright}
                    style={child.isDocument ? undefined : treeStyles.dot}
                  />
                  <Text style={[treeStyles.childTitle, { color: colors.text }]} numberOfLines={2}>
                    {child.label}
                  </Text>
                  <QuantityChip quantity={child.quantity} />
                  {mode === 'template' && childEditable ? (
                    <Ionicons name="create-outline" size={16} color={colors.textMuted} style={treeStyles.chevron} />
                  ) : null}
                  {ticks(child)}
                </RowShell>
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

function SmallIcon({
  icon,
  color,
  label,
  onPress,
  filled,
}: {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const ocean = useOcean();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        treeStyles.smallIcon,
        filled && { backgroundColor: ocean.mist },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

const treeStyles = StyleSheet.create({
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingEnd: TICK_EDGE,
    marginBottom: -Spacing.xs,
  },
  columnText: { fontSize: 11, fontWeight: '800' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingStart: Spacing.md,
    paddingEnd: Spacing.md,
  },
  rowTicks: { paddingEnd: TICK_EDGE },
  indent: { paddingStart: Spacing.lg + 6, paddingVertical: 10 },
  groupIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontSize: 11, fontWeight: '600' },
  bar: { flex: 1, maxWidth: 120, height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  chevron: { marginHorizontal: 4 },
  childWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  childTitle: { flex: 1, fontSize: 14 },
  dot: { marginHorizontal: 5 },
  qty: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 7, paddingVertical: 1 },
  qtyText: { fontSize: 11, fontWeight: '800' },
  smallIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

// --- add / edit popup -----------------------------------------------------

export type ChecklistEditorTarget =
  | { kind: 'add'; parentId: string | null }
  | { kind: 'edit'; itemId: string; name: string; quantity: number; isGroup: boolean; deletable: boolean };

/**
 * Popup to add an item (name, quantity, group) or edit one. Items added from a
 * trip go into the main list, so every trip gets them.
 */
export function ChecklistItemModal({
  target,
  groups,
  onClose,
  onSubmit,
  onDelete,
}: {
  target: ChecklistEditorTarget | null;
  /** Entries an item can be filed under (top-level entries). */
  groups: { id: string; label: string }[];
  onClose: () => void;
  onSubmit: (input: { name: string; quantity: number; parentId: string | null }) => void;
  onDelete?: () => void;
}) {
  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      {target ? (
        <EditorBody
          key={target.kind === 'edit' ? target.itemId : `add-${target.parentId ?? ''}`}
          target={target}
          groups={groups}
          onClose={onClose}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />
      ) : null}
    </Modal>
  );
}

function EditorBody({
  target,
  groups,
  onClose,
  onSubmit,
  onDelete,
}: {
  target: ChecklistEditorTarget;
  groups: { id: string; label: string }[];
  onClose: () => void;
  onSubmit: (input: { name: string; quantity: number; parentId: string | null }) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const ocean = useOcean();
  const [name, setName] = useState(target.kind === 'edit' ? target.name : '');
  const [quantity, setQuantity] = useState(target.kind === 'edit' ? target.quantity : 1);
  const [parentId, setParentId] = useState<string | null>(target.kind === 'add' ? target.parentId : null);
  const [error, setError] = useState(false);
  const showQuantity = target.kind === 'add' || !target.isGroup;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    onSubmit({ name: trimmed, quantity, parentId });
    if (target.kind === 'edit') showSavedToast();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <View style={modalStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[modalStyles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[modalStyles.badge, { backgroundColor: ocean.mist }]}>
            <Ionicons name={target.kind === 'add' ? 'add' : 'create-outline'} size={22} color={ocean.main} />
          </View>
          <Text style={[modalStyles.title, { color: colors.text }]}>
            {target.kind === 'add' ? t('checklist.addItem') : t('checklist.editItem')}
          </Text>

          <Text style={[modalStyles.label, { color: colors.textMuted }]}>{t('checklist.name')}</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(false);
            }}
            autoFocus={target.kind === 'add'}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[
              modalStyles.input,
              {
                color: colors.text,
                backgroundColor: colors.surfaceMuted,
                borderColor: error ? colors.danger : 'transparent',
              },
            ]}
            placeholderTextColor={colors.textMuted}
          />

          {showQuantity ? (
            <View style={modalStyles.qtyRow}>
              <Text style={[modalStyles.label, { color: colors.textMuted, flex: 1, marginBottom: 0 }]}>
                {t('checklist.quantity')}
              </Text>
              <StepButton
                icon="remove"
                disabled={quantity <= 1}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              />
              <Text style={[modalStyles.qtyValue, { color: colors.text }]}>{quantity}</Text>
              <StepButton
                icon="add"
                disabled={quantity >= 99}
                onPress={() => setQuantity((q) => Math.min(99, q + 1))}
              />
            </View>
          ) : null}

          {target.kind === 'add' && groups.length > 0 ? (
            <>
              <Text style={[modalStyles.label, { color: colors.textMuted, marginTop: Spacing.md }]}>
                {t('checklist.parent')}
              </Text>
              <View style={modalStyles.chips}>
                {[{ id: null as string | null, label: t('checklist.topLevel') }, ...groups].map((g) => {
                  const active = g.id === parentId;
                  return (
                    <Pressable
                      key={g.id ?? 'top'}
                      onPress={() => setParentId(g.id)}
                      style={[
                        modalStyles.chip,
                        active
                          ? { backgroundColor: ocean.main, borderColor: ocean.main }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[modalStyles.chipText, { color: active ? '#FFFFFF' : colors.text }]}
                        numberOfLines={1}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [modalStyles.primary, { backgroundColor: ocean.main, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={modalStyles.primaryText}>{target.kind === 'add' ? t('common.add') : t('common.save')}</Text>
          </Pressable>
          {target.kind === 'edit' && target.deletable && onDelete ? (
            <Pressable accessibilityRole="button" onPress={onDelete} style={modalStyles.secondary} hitSlop={6}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[modalStyles.secondaryText, { color: colors.danger }]}>{t('common.delete')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function StepButton({ icon, onPress, disabled }: { icon: IconName; onPress: () => void; disabled?: boolean }) {
  const ocean = useOcean();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        modalStyles.step,
        { backgroundColor: ocean.mist, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={ocean.main} />
    </Pressable>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.xl },
  sheet: { borderRadius: 22, padding: Spacing.lg, paddingTop: Spacing.xl },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.md },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: 15,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  qtyValue: { fontSize: 17, fontWeight: '800', minWidth: 26, textAlign: 'center' },
  step: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '600' },
  primary: { marginTop: Spacing.lg, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
  secondaryText: { fontSize: 14, fontWeight: '700' },
});
