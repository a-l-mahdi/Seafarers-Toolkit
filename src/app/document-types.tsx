import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { FormScrollView, LabeledInput } from '@/components/ui/form';
import { DocIconPicker, DocTypeIcon } from '@/components/doc-icon';
import { useCreateDocumentType, useDeleteDocumentType, useDocumentTypes, useUpdateDocumentType } from '@/hooks/queries';
import { DEFAULT_DOC_ICONS, resolveDocIcon, type DocIcon } from '@/domain/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { showSavedToast } from '@/components/saved-toast';
import { Radius, Spacing } from '@/constants/theme';
import type { DocumentType } from '@/types/domain';

/** The type being edited, or 'new' while adding one. */
type Editing = DocumentType | 'new' | null;

export default function DocumentTypesScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const router = useRouter();
  const { data: types } = useDocumentTypes();
  const remove = useDeleteDocumentType();
  const [editing, setEditing] = useState<Editing>(null);

  const confirmRemove = (id: string) => {
    Alert.alert(t('common.delete'), t('documents.deleteTypeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={t('documents.typesTitle')}
        onBack={() => router.back()}
        actions={[{ icon: 'add', label: t('documents.addType'), onPress: () => setEditing('new') }]}
      />
      <FormScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.container,
          { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom },
        ]}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <Card>
          {(types ?? []).length === 0 ? (
            <Text style={{ color: colors.textMuted }}>{t('documents.noTypes')}</Text>
          ) : (
            (types ?? []).map((ty, i) => (
              <Pressable
                key={ty.id}
                onPress={() => setEditing(ty)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  i === (types ?? []).length - 1 && styles.lastRow,
                ]}
              >
                <DocTypeIcon value={resolveDocIcon(ty.id, ty.icon, ty.color)} size={40} />
                <Text style={{ color: colors.text, flex: 1, fontSize: 15 }} numberOfLines={2}>
                  {ty.name}
                </Text>
                <Pressable onPress={() => confirmRemove(ty.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </Pressable>
            ))
          )}
        </Card>
      </FormScrollView>

      {editing ? (
        <DocTypeModal
          key={editing === 'new' ? 'new' : editing.id}
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
}

/** Adds a type, or edits one's name and icon. */
function DocTypeModal({ type, onClose }: { type: DocumentType | null; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const create = useCreateDocumentType();
  const update = useUpdateDocumentType();
  const [name, setName] = useState(type?.name ?? '');
  const [icon, setIcon] = useState<DocIcon>(resolveDocIcon(type?.id ?? null, type?.icon ?? null, type?.color ?? null));
  const [error, setError] = useState<string | null>(null);
  const builtIn = type ? DEFAULT_DOC_ICONS[type.id] : undefined;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('documents.typeNameRequired'));
      return;
    }
    // Keep NULL while the icon equals the built-in default, so it follows future defaults.
    const base = resolveDocIcon(type?.id ?? null, null, null);
    const payload = {
      name: trimmed,
      icon: icon.icon === base.icon ? null : icon.icon,
      color: icon.color === base.color ? null : icon.color,
    };
    if (type) update.mutate({ id: type.id, ...payload });
    else create.mutate(payload);
    showSavedToast();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: Spacing.md }}
          >
            <View style={[styles.preview, { backgroundColor: `${icon.color}14` }]}>
              <DocTypeIcon value={icon} size={72} solid />
              <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={2}>
                {name.trim() || t(type ? 'documents.editType' : 'documents.addType')}
              </Text>
            </View>
            <LabeledInput label={t('documents.typeName')} value={name} onChangeText={setName} error={error} />
            <DocIconPicker value={icon} onChange={setIcon} />
            {builtIn ? (
              <Pressable onPress={() => setIcon(builtIn)} style={styles.reset} hitSlop={6}>
                <Ionicons name="refresh" size={15} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('documents.defaultIcon')}</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={{ color: colors.danger }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={save} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  backdrop: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: Radius.lg, padding: Spacing.lg, maxHeight: '90%' },
  preview: { borderRadius: Radius.lg, alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  previewName: { fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: Spacing.md },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md },
});
