import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parse, SvgAst, type JsxAST } from 'react-native-svg';
import * as FLAGS from 'country-flag-icons/string/3x2';
import { Text, TextInput } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import {
  countryByCode,
  countryName,
  matchesCountry,
  resolveCountry,
  sortedCountries,
  type Country,
} from '@/domain/countries';
import { addRecentCountry, getRecentCountries, type RecentCountryKind } from '@/database/repositories/ranks-repository';
import { Radius, Spacing } from '@/constants/theme';

const FLAG_SVGS = FLAGS as unknown as Record<string, string>;

// Parsing a flag's SVG text is the slow part of drawing it: parse each flag
// once per app run and reuse the tree everywhere (list rows, fields, cards).
const FLAG_ASTS = new Map<string, JsxAST | null>();
function flagAst(code: string): JsxAST | null {
  let ast = FLAG_ASTS.get(code);
  if (ast === undefined) {
    const xml = FLAG_SVGS[code];
    ast = xml ? parse(xml) : null;
    FLAG_ASTS.set(code, ast);
  }
  return ast;
}

/**
 * A country's flag as a small Material-style tile: the colored SVG flag with
 * rounded corners, a soft light sheen, a hairline edge and a slight lift.
 */
export const CountryFlag = memo(function CountryFlag({
  code,
  width = 28,
}: {
  code: string | null | undefined;
  width?: number;
}) {
  const colors = useTheme();
  const height = Math.round((width * 2) / 3);
  const radius = Math.max(3, Math.round(width / 8));
  const ast = code ? flagAst(code.toUpperCase()) : null;

  return (
    <View style={[styles.flagLift, { width, height, borderRadius: radius, backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.flagClip, { borderRadius: radius }]}>
        {ast ? (
          <SvgAst ast={ast} override={{ width, height, preserveAspectRatio: 'xMidYMid slice' }} />
        ) : (
          <View style={styles.flagMissing}>
            <Ionicons name="flag" size={height * 0.6} color={colors.textMuted} />
          </View>
        )}
        {/* Light sheen on the upper half, a faint shade on the lower (plain views:
            a second SVG per flag would double the drawing cost in long lists). */}
        <View pointerEvents="none" style={[styles.sheenTop, { height: height / 2 }]} />
        <View pointerEvents="none" style={[styles.shadeBottom, { height: height / 2 }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flagEdge, { borderRadius: radius }]} />
      </View>
    </View>
  );
});

/** A stored flag / nationality as flag + localized name (old free text shown as typed). */
export function CountryText({
  value,
  width = 22,
  color,
  size = 14,
}: {
  value: string | null | undefined;
  width?: number;
  color?: string;
  size?: number;
}) {
  const { i18n } = useTranslation();
  const colors = useTheme();
  const country = resolveCountry(value);
  const label = country ? countryName(country, i18n.language) : value?.trim();
  if (!label) return null;
  return (
    <View style={styles.inline}>
      {country ? <CountryFlag code={country.code} width={width} /> : null}
      <Text style={{ color: color ?? colors.text, fontSize: size, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Form field that picks a country from the full ISO list; stores the alpha-2 code. */
export function CountryPickerField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  kind: RecentCountryKind;
}) {
  const { t, i18n } = useTranslation();
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const country = resolveCountry(value);
  const text = country ? countryName(country, i18n.language) : value.trim();
  // Loaded with the form, so the sheet has its recents the moment it opens.
  useRecentCountries(kind);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {country ? <CountryFlag code={country.code} width={28} /> : null}
        <Text style={[styles.triggerText, { color: text ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {text || t('countries.select')}
        </Text>
        {text ? (
          <Pressable onPress={() => onChange('')} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        )}
      </Pressable>
      {open ? (
        <CountrySheet
          title={label}
          kind={kind}
          selected={country?.code ?? null}
          onClose={() => setOpen(false)}
          onPick={(code) => {
            onChange(code);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

type Section = { key: string; title: string; data: Country[] };

function useRecentCountries(kind: RecentCountryKind) {
  return useQuery({
    queryKey: ['recentCountries', kind],
    queryFn: () => getRecentCountries(kind),
    staleTime: Infinity,
  });
}

const CountryRow = memo(function CountryRow({
  country,
  name,
  active,
  onPick,
}: {
  country: Country;
  name: string;
  active: boolean;
  onPick: (code: string) => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={() => onPick(country.code)}
      style={({ pressed }) => [styles.row, (active || pressed) && { backgroundColor: colors.surfaceMuted }]}
    >
      <CountryFlag code={country.code} width={30} />
      <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      {active ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      ) : (
        <Text style={[styles.rowCode, { color: colors.textMuted }]}>{country.code}</Text>
      )}
    </Pressable>
  );
});

function CountrySheet({
  title,
  kind,
  selected,
  onPick,
  onClose,
}: {
  title: string;
  kind: RecentCountryKind;
  selected: string | null;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  // The list is mounted once the sheet is on screen: the tap answers at once
  // and the slide-in stays smooth instead of waiting for the rows to draw.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Fallback in case the Modal's onShow is not delivered.
    const id = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(id);
  }, []);
  const { data: recentCodes } = useRecentCountries(kind);

  const all = useMemo(() => sortedCountries(i18n.language), [i18n.language]);
  const sections = useMemo<Section[]>(() => {
    if (query.trim()) {
      const found = all.filter((c) => matchesCountry(c, query));
      return found.length ? [{ key: 'found', title: '', data: found }] : [];
    }
    const recent = (recentCodes ?? []).map(countryByCode).filter((c): c is Country => !!c);
    return [
      ...(recent.length ? [{ key: 'recent', title: t('countries.recent'), data: recent }] : []),
      { key: 'all', title: t('countries.all'), data: all },
    ];
  }, [all, query, recentCodes, t]);

  const pick = useCallback(
    (code: string) => {
      onPick(code);
      void addRecentCountry(kind, code).then(() =>
        queryClient.invalidateQueries({ queryKey: ['recentCountries', kind] }),
      );
    },
    [onPick, kind, queryClient],
  );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => setReady(true)}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceMuted }]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('countries.search')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {ready ? (
            <SectionList
              sections={sections}
              keyExtractor={(item, index) => `${item.code}-${index}`}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              stickySectionHeadersEnabled={false}
              initialNumToRender={14}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
              renderSectionHeader={({ section }) =>
                section.title ? (
                  <View style={styles.sectionHeader}>
                    <Ionicons
                      name={section.key === 'recent' ? 'time-outline' : 'earth-outline'}
                      size={15}
                      color={colors.primary}
                    />
                    <Text style={[styles.sectionTitle, { color: colors.primary }]}>{section.title}</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <CountryRow
                  country={item}
                  name={countryName(item, i18n.language)}
                  active={item.code === selected}
                  onPick={pick}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="earth-outline" size={36} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, marginTop: Spacing.sm }}>{t('countries.noResults')}</Text>
                </View>
              }
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flagLift: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  flagClip: { flex: 1, overflow: 'hidden' },
  flagMissing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheenTop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#FFFFFF1F' },
  shadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0000000F' },
  flagEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#00000033' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  triggerText: { flex: 1, fontSize: 15 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  sheet: {
    height: '85%',
    borderTopLeftRadius: Radius.lg + 8,
    borderTopRightRadius: Radius.lg + 8,
    overflow: 'hidden',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: Spacing.sm },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  rowName: { flex: 1, fontSize: 15 },
  rowCode: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
});
