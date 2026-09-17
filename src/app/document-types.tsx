import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card } from '@/components/ui/primitives';
import { FormScrollView, LabeledInput } from '@/components/ui/form';
import { useCreateDocumentType, useDeleteDocumentType, useDocumentTypes } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function DocumentTypesScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { data: types } = useDocumentTypes();
  const create = useCreateDocumentType();
  const remove = useDeleteDocumentType();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const name = newName.trim();
    if (!name) {
      setError(t('documents.typeNameRequired'));
      return;
    }
    create.mutate(name);
    setNewName('');
    setError(null);
  };

  const confirmRemove = (id: string) => {
    Alert.alert(t('common.delete'), t('documents.deleteTypeConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  };

  return (
    <FormScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: Spacing.xxl + insets.bottom }]}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('documents.typesTitle'),
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <Card>
        {(types ?? []).length === 0 ? (
          <Text style={{ color: colors.textMuted }}>{t('documents.noTypes')}</Text>
        ) : (
          (types ?? []).map((ty, i) => (
            <View
              key={ty.id}
              style={[
                styles.row,
                { borderBottomColor: colors.border },
                i === (types ?? []).length - 1 && styles.lastRow,
              ]}
            >
              <Text style={{ color: colors.text, flex: 1 }}>{ty.name}</Text>
              <Pressable onPress={() => confirmRemove(ty.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={[styles.addTitle, { color: colors.text }]}>{t('documents.addType')}</Text>
        <LabeledInput label={t('documents.typeName')} value={newName} onChangeText={setNewName} error={error} />
        <Button label={t('documents.addType')} onPress={add} />
      </Card>
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastRow: { borderBottomWidth: 0 },
  addTitle: { fontSize: 15, fontWeight: '700', marginBottom: Spacing.sm },
});
