import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@/components/ui/primitives';
import { LabeledInput, Select } from '@/components/ui/form';
import { useCreateRank, useDeleteRank, useRanks } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import type { Department } from '@/types/domain';

export default function RanksScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: ranks } = useRanks();
  const create = useCreateRank();
  const remove = useDeleteRank();

  const [name, setName] = useState('');
  const [department, setDepartment] = useState<Department>('deck');
  const [level, setLevel] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError(t('ranks.errors.nameRequired'));
      return;
    }
    create.mutate({ department, name: name.trim(), level: parseInt(level, 10) || 1 });
    setName('');
    setError(null);
  };

  const confirmDelete = (id: string) => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  const departments: Department[] = ['deck', 'engine', 'electro', 'other'];

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]} style={{ backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('ranks.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Card>
        <LabeledInput label={t('ranks.name')} value={name} onChangeText={setName} error={error} />
        <Select
          label={t('profile.department')}
          value={department}
          options={departments.map((d) => ({ id: d, label: t(`profile.departments.${d}`) }))}
          onSelect={(v) => setDepartment(v as Department)}
        />
        <LabeledInput label={t('ranks.level')} value={level} onChangeText={setLevel} keyboardType="numeric" />
        <Button label={`+ ${t('ranks.add')}`} onPress={submit} variant="secondary" />
      </Card>
      {departments.map((dep) => {
        const depRanks = (ranks ?? []).filter((r) => r.department === dep);
        if (depRanks.length === 0) return null;
        return (
          <Card key={dep}>
            <Text style={[styles.depTitle, { color: colors.text }]}>
              {t(`profile.departments.${dep}`)}
            </Text>
            {depRanks.map((rank) => (
              <View key={rank.id} style={styles.row}>
                <Text style={{ color: colors.text, flex: 1 }}>
                  {rank.name} {rank.isDefault ? '' : '· custom'}
                </Text>
                {!rank.isDefault ? (
                  <Text style={{ color: colors.danger }} onPress={() => confirmDelete(rank.id)}>
                    ✕
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  depTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
});
