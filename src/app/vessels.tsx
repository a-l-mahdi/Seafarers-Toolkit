import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState } from '@/components/ui/primitives';
import { LabeledInput } from '@/components/ui/form';
import { useDeleteVessel, useVessels } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';

export default function VesselsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: vessels } = useVessels();
  const [search, setSearch] = useState('');

  const filtered = (vessels ?? []).filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.imo ?? '').includes(search)
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('vessels.title'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <View style={styles.searchRow}>
        <LabeledInput label={t('common.search')} value={search} onChangeText={setSearch} />
        <Link href="/vessel-form" asChild>
          <Button label={`+ ${t('vessels.add')}`} onPress={() => undefined} />
        </Link>
      </View>
      <FlatList nestedScrollEnabled
        contentContainerStyle={[styles.list, { paddingBottom: Spacing.xxl + insets.bottom }]}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VesselRow id={item.id} name={item.name} imo={item.imo} flag={item.flag} type={item.type} />}
        ListEmptyComponent={<EmptyState title={t('vessels.noVessels')} />}
      />
    </View>
  );
}

function VesselRow(props: { id: string; name: string; imo: string | null; flag: string | null; type: string | null }) {
  const { t } = useTranslation();
  const colors = useTheme();
 const remove = useDeleteVessel();

  const confirmDelete = () => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(props.id) },
    ]);
  };

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Link href={`/vessel-form?id=${props.id}`} asChild>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{props.name}</Text>
        </Link>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {props.imo ?? '—'} · {props.type ?? '—'} · {props.flag ?? '—'}
        </Text>
      </View>
      <Text style={{ color: colors.danger }} onPress={confirmDelete}>
        ✕
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.lg,
  },
});
