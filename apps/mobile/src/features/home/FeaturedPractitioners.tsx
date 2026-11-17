import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { EmptyState, ErrorBox, Skeleton, monoStyle } from '../../components/primitives';
import { formatPaise, rupeesToPaise } from '../../lib/money';
import { usePractitioners } from '../consultations/queries';
import { Stethoscope } from 'lucide-react-native';

// Verified practitioners who are taking bookings. Opens the Consultations tab to book.
export function FeaturedPractitioners() {
  const practitioners = usePractitioners();

  if (practitioners.isPending) return <Skeleton height={130} />;
  if (practitioners.isError) return <ErrorBox message={practitioners.error.message} />;
  if (practitioners.data.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No doctors are taking bookings"
        description="Verified doctors appear here once they open slots."
      />
    );
  }

  return (
    <FlatList
      data={practitioners.data}
      horizontal
      keyExtractor={(doctor) => doctor.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ width: SPACE.md }} />}
      renderItem={({ item: doctor }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Book ${doctor.full_name}`}
          onPress={() => router.navigate('/(tabs)/consultations')}
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        >
          <View style={styles.avatar} accessibilityElementsHidden>
            <Text style={styles.avatarText}>{doctor.full_name.charAt(0)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {doctor.full_name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {doctor.qualification}
          </Text>
          <Text style={[styles.fee, monoStyle]}>
            {formatPaise(rupeesToPaise(Number(doctor.consultation_fee_inr)))} · {doctor.slot_duration_minutes} min
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: SPACE.xs },
  card: {
    width: 180,
    gap: SPACE.xs,
    padding: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.s1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
  },
  pressed: { opacity: 0.85 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.s3,
  },
  avatarText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  name: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 12 },
  fee: { color: COLORS.textMuted, fontSize: 12 },
});
