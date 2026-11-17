import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACE } from '../../../constants/theme';
import { Button, Card, Pill, monoStyle } from '../../components/primitives';
import { formatPaise, rupeesToPaise } from '../../lib/money';

export interface PractitionerView {
  id: string;
  full_name: string;
  qualification: string;
  years_of_experience: number | null;
  consultation_fee_inr: number | string;
  slot_duration_minutes: number;
  languages_spoken: string[] | null;
}

export function DoctorCard({ doctor, onBook }: { doctor: PractitionerView; onBook: (doctor: PractitionerView) => void }) {
  const fee = formatPaise(rupeesToPaise(Number(doctor.consultation_fee_inr)));
  const languages = doctor.languages_spoken?.join(', ');
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden>
          <Text style={styles.avatarText}>{doctor.full_name.charAt(0)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{doctor.full_name}</Text>
          <Text style={styles.qualification}>{doctor.qualification}</Text>
        </View>
      </View>
      <View style={styles.pills}>
        <Pill label={`${fee} fee`} tone="blue" />
        <Pill label={`${doctor.slot_duration_minutes}-min slots`} />
        {doctor.years_of_experience !== null ? <Pill label={`${doctor.years_of_experience} yrs`} /> : null}
      </View>
      {languages ? <Text style={[styles.meta, monoStyle]}>{languages}</Text> : null}
      <Button label="Book consultation" onPress={() => onBook(doctor)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.s3,
  },
  avatarText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  identity: { flex: 1, gap: 2 },
  name: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  qualification: { color: COLORS.textSecondary, fontSize: 13 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  meta: { color: COLORS.textMuted, fontSize: 12 },
});
