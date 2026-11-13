import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, Button, ErrorBox, Heading, Skeleton, EmptyState } from '../../src/components/primitives';
import { BookingSheet } from '../../src/features/consultations/BookingSheet';
import { ChatSheet, type ChatTarget } from '../../src/features/consultations/ChatSheet';
import { ConsultationList } from '../../src/features/consultations/ConsultationList';
import { DoctorCard, type PractitionerView } from '../../src/features/consultations/DoctorCard';
import { usePractitioners } from '../../src/features/consultations/queries';
import { Stethoscope } from 'lucide-react-native';
import { COLORS, SPACE } from '../../constants/theme';

export default function ConsultationsScreen() {
  const practitioners = usePractitioners();
  const [booking, setBooking] = useState<PractitionerView | null>(null);
  const [chat, setChat] = useState<ChatTarget | null>(null);

  // Opened from an expired chat: book the same doctor again.
  const bookAgain = (doctorId: string) => {
    const doctor = practitioners.data?.find((candidate) => candidate.id === doctorId) ?? null;
    setChat(null);
    setBooking(doctor);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Heading eyebrow="Telemedicine" title="Consultations" />

        <Section title="Your consultations">
          <ConsultationList onOpenChat={setChat} />
        </Section>

        <Section title="Find a doctor">
          {practitioners.isPending ? <Skeleton height={200} /> : null}
          {practitioners.isError ? <ErrorBox message={practitioners.error.message} /> : null}
          {practitioners.data?.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors are accepting consultations"
              description="Verified doctors appear here once they open slots."
              action={{ label: 'Refresh', onPress: () => void practitioners.refetch() }}
            />
          ) : null}
          {practitioners.data?.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} onBook={setBooking} />
          ))}
        </Section>
      </ScrollView>

      <BookingSheet doctor={booking} onClose={() => setBooking(null)} />
      <ChatSheet target={chat} onClose={() => setChat(null)} onBookAgain={bookAgain} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.xl, gap: SPACE.xl, paddingBottom: SPACE.xxl },
  section: { gap: SPACE.md },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
});
