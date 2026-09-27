import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { HeaderMenu } from '@/components/header-menu';
import { useDeleteVessel, useVessels } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing } from '@/constants/theme';
import { CountryFlag } from '@/components/country-picker';
import { countryLabel, resolveCountry } from '@/domain/countries';

export default function VesselsScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const router = useRouter();
  const { data: vessels } = useVessels();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeSearch = () => {
    setSearch('');
    setSearching(false);
  };

  const filtered = (vessels ?? []).filter(
    (v) => v.name.toLowerCase().includes(search.toLowerCase()) || (v.imo ?? '').includes(search),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TelegramHeader
        title={t('vessels.title')}
        onBack={() => router.back()}
        actions={[{ icon: 'ellipsis-vertical', label: t('tabs.more'), onPress: () => setMenuOpen(true) }]}
      />
      <HeaderMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { icon: 'add', label: t('vessels.add'), onPress: () => router.push('/vessel-form') },
          { icon: 'search', label: t('common.search'), onPress: () => setSearching(true) },
        ]}
      />
      <FlatList
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
        ListHeaderComponent={
          searching ? (
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                autoFocus
                value={search}
                onChangeText={setSearch}
                placeholder={t('common.search')}
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
              />
              <Pressable onPress={closeSearch} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null
        }
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VesselRow
            id={item.id}
            name={item.name}
            imo={item.imo}
            flag={item.flag}
            type={item.type}
            photo={item.photoPath}
          />
        )}
        ListEmptyComponent={<EmptyState title={t('vessels.noVessels')} />}
      />
    </View>
  );
}

function VesselRow(props: {
  id: string;
  name: string;
  imo: string | null;
  flag: string | null;
  type: string | null;
  photo: string | null;
}) {
  const { t, i18n } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const remove = useDeleteVessel();
  const flagCode = resolveCountry(props.flag)?.code;

  const confirmDelete = () => {
    Alert.alert(t('common.delete'), t('common.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(props.id, {
            onError: (err) => {
              Alert.alert(
                t('common.delete'),
                err instanceof Error && err.message === 'VESSEL_IN_USE'
                  ? t('vessels.inUse')
                  : t('vessels.deleteFailed'),
              );
            },
          }),
      },
    ]);
  };

  return (
    <Pressable
      onPress={() => router.push(`/vessel-detail?id=${props.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.primaryMuted }]}>
        {props.photo ? (
          <Image source={{ uri: props.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name="boat" size={22} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{props.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
          {props.imo ?? '—'} · {props.type ?? '—'} · {countryLabel(props.flag, i18n.language) ?? '—'}
        </Text>
      </View>
      {flagCode ? <CountryFlag code={flagCode} width={30} /> : null}
      <Pressable onPress={confirmDelete} hitSlop={12}>
        <Text style={{ color: colors.danger }}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  thumb: {
    width: 72,
    height: 44,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
