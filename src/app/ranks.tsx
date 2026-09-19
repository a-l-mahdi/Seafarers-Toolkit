import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui/primitives';
import { FormScrollView, LabeledInput, Select } from '@/components/ui/form';
import { useCreateRank, useDeleteRank, useMoveRank, useRanks, useUpdateRank } from '@/hooks/queries';
import { isTopRank } from '@/domain/career';
import { buildRankColorMap } from '@/domain/rank-color';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import type { Department, Rank as RankType } from '@/types/domain';

const DEPARTMENTS: Department[] = [
  'deck',
  'engine',
  'electro',
  'deck_rating',
  'engine_rating',
  'catering',
];

export default function RanksScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: ranks } = useRanks();
  const create = useCreateRank();
  const update = useUpdateRank();
  const move = useMoveRank();
  const remove = useDeleteRank();
  const rankColors = buildRankColorMap(ranks ?? []);

  const [editing, setEditing] = useState(false);
  // Draft values for names + promotion months, applied with the Save button.
  const [drafts, setDrafts] = useState<Record<string, { name: string; promotionMonths: string }>>({});
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState<Department>('deck');
  const [error, setError] = useState<string | null>(null);

  const draftFor = (rank: RankType) =>
    drafts[rank.id] ?? {
      name: rank.name,
      promotionMonths: rank.promotionMonths != null ? String(rank.promotionMonths) : '',
    };

  const submit = () => {
    if (!newName.trim()) {
      setError(t('ranks.errors.nameRequired'));
      return;
    }
    // New ranks land at the bottom of their department; reorder after.
    const level = (ranks ?? [])
      .filter((r) => r.department === newDepartment)
      .reduce((max, r) => Math.max(max, r.level), 0) + 1;
    create.mutate({ department: newDepartment, name: newName.trim(), level });
    setNewName('');
    setError(null);
  };

  const confirmDelete = (id: string) => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  const saveChanges = () => {
    for (const rank of ranks ?? []) {
      const draft = drafts[rank.id];
      if (!draft) continue;
      const changedName = draft.name.trim() !== rank.name;
      const changedMonths =
        draft.promotionMonths.trim() !== (rank.promotionMonths != null ? String(rank.promotionMonths) : '');
      if (!changedName && !changedMonths) continue;
      update.mutate({
        ...rank,
        name: draft.name.trim() || rank.name,
        promotionMonths: draft.promotionMonths.trim()
          ? Math.max(parseInt(draft.promotionMonths, 10) || 12, 1)
          : null,
      });
    }
    setDrafts({});
    setEditing(false);
  };

  const isDepartmentTop = (rank: RankType) => isTopRank(rank.id, ranks ?? []);

  return (
    <FormScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('ranks.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <Button
        label={editing ? t('ranks.done') : t('ranks.edit')}
        onPress={() => {
          if (editing) saveChanges();
          setEditing(!editing);
        }}
      />
      {editing ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
          {t('ranks.editHint')}
        </Text>
      ) : null}

      {DEPARTMENTS.map((dep) => {
        const depRanks = (ranks ?? []).filter((r) => r.department === dep);
        if (depRanks.length === 0 && !editing) return null;
        return (
          <Card key={dep}>
            <Text style={[styles.depTitle, { color: colors.text }]}>
              {t(`profile.departments.${dep}`)}
            </Text>
            {depRanks.map((rank, index) => {
              const draft = draftFor(rank);
              const months = rank.promotionMonths ?? 12;
              return (
                <View key={rank.id} style={styles.row}>
                  {editing ? (
                    <View style={styles.editRow}>
                      <View style={styles.moveCol}>
                        <Pressable
                          disabled={index === 0}
                          onPress={() => move.mutate({ id: rank.id, dir: -1 })}
                          style={index === 0 ? styles.disabled : undefined}
                        >
                          <Ionicons name="chevron-up" size={20} color={index === 0 ? colors.textMuted : colors.primary} />
                        </Pressable>
                        <Pressable
                          disabled={index === depRanks.length - 1}
                          onPress={() => move.mutate({ id: rank.id, dir: 1 })}
                          style={index === depRanks.length - 1 ? styles.disabled : undefined}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color={index === depRanks.length - 1 ? colors.textMuted : colors.primary}
                          />
                        </Pressable>
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                          value={draft.name}
                          onChangeText={(v) =>
                            setDrafts((d) => ({ ...d, [rank.id]: { ...draftFor(rank), name: v } }))
                          }
                        />
                        <TextInput
                          style={[styles.textInput, styles.monthsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                          value={draft.promotionMonths}
                          keyboardType="numeric"
                          placeholder={t('ranks.promotionMonths')}
                          placeholderTextColor={colors.textMuted}
                          onChangeText={(v) =>
                            setDrafts((d) => ({ ...d, [rank.id]: { ...draftFor(rank), promotionMonths: v } }))
                          }
                        />
                      </View>
                      <Pressable onPress={() => confirmDelete(rank.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.viewRow}>
                      <View style={[styles.colorDot, { backgroundColor: rankColors.get(rank.id) ?? colors.border }]} />
                      <Text style={{ color: colors.text, flex: 1 }}>{rank.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                        {isDepartmentTop(rank)
                          ? t('career.topRank')
                          : `${months} ${t('common.month')}`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            {editing && depRanks.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('ranks.emptyDepartment')}</Text>
            ) : null}
          </Card>
        );
      })}

      <Card>
        <Text style={[styles.depTitle, { color: colors.text }]}>{t('ranks.add')}</Text>
        <LabeledInput label={t('ranks.name')} value={newName} onChangeText={setNewName} error={error} />
        <Select
          label={t('profile.department')}
          value={newDepartment}
          options={DEPARTMENTS.map((d) => ({ id: d, label: t(`profile.departments.${d}`) }))}
          onSelect={(v) => setNewDepartment(v as Department)}
        />
        <Button
          label={`+ ${t('ranks.add')}`}
          onPress={submit}
          variant="secondary"
          disabled={!editing}
        />
        {editing ? null : (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: Spacing.sm }}>
            {t('ranks.editHint')}
          </Text>
        )}
      </Card>

      {editing ? (
        <Button label={t('common.save')} onPress={saveChanges} />
      ) : null}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  depTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
  row: { paddingVertical: Spacing.xs },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  moveCol: { gap: 2, alignItems: 'center' },
  disabled: { opacity: 0.3 },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  monthsInput: { marginTop: Spacing.xs },
});
