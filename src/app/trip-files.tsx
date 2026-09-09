import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';
import { HeaderBar } from '@/components/ui/form';
import { ContractFilesSection } from '@/components/contract-files';
import { useContracts } from '@/hooks/queries';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

/** Trip documents viewer — opens from a sea-time record to show the contract
 * scan and the final wages account for that voyage. */
export default function TripFilesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const { data: contracts } = useContracts();
  const contract = contracts?.find((c) => c.id === contractId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={t('tripFiles.title')} onBack={() => router.back()} />
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.form}>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {contract?.vesselName ?? '—'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {contract?.rankName ?? '—'} · {contract?.joinDate} → {contract?.actualSignOff ?? contract?.expectedSignOff}
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
