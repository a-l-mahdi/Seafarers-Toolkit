import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { ContractFilesSection } from '@/components/contract-files';
import { useContracts } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { useFormattedDate } from '@/hooks/use-date-format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

/** Trip documents viewer — opens from a sea-time record to show the contract
 * scan and the final wages account for that voyage. */
export default function TripFilesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const formatDate = useFormattedDate();
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const { data: contracts } = useContracts();
  const contract = contracts?.find((c) => c.id === contractId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TelegramHeader title={t('tripFiles.title')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.form, { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom }]}
      >
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{contract?.vesselName ?? '—'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {contract?.rankName ?? '—'} ·{' '}
            {contract
              ? `${formatDate(contract.joinDate)} → ${formatDate(contract.actualSignOff ?? contract.expectedSignOff)}`
              : ''}
          </Text>
        </Card>
        {contractId ? (
          <ContractFilesSection contractId={contractId} />
        ) : (
          <Text style={{ color: colors.textMuted }}>{t('common.notSet')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
});
