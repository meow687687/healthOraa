import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarX } from 'lucide-react-native';
import { COLORS, SPACE } from '../../../constants/theme';
import { Button, Card, EmptyState, ErrorBox, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { formatIstDateTime } from '../../lib/time';
import { useMyConsultations } from './queries';
import { startCheckout } from '../../lib/payments';
import { ChatSheet, type ChatTarget } from './ChatSheet';

export type ConsultationRowData = NonNullable<ReturnType<typeof useMyConsultations>['data']>[number];

type Tab = 'upcoming' | 'past';

// Upcoming covers anything not yet completed, cancelled or past its slot. Past holds the rest.
const isUpcoming = (row: ConsultationRowData, now: number): boolean =>
  row.status !== 'completed' && row.status !== 'cancelled' && new Date(row.slot_end).getTime() > now;

export function ConsultationList({ onOpenChat }: { onOpenChat: (target: ChatTarget) => void }) {
  const consultations = useMyConsultations();
  const [tab, setTab] = useState<Tab>('upcoming');

  if (consultations.isPending) return <Skeleton height={120} />;
  if (consultations.isError) return <ErrorBox message={consultations.error.message} />;

  const now = Date.now();
  const rows = consultations.data.filter((row) => (tab === 'upcoming') === isUpcoming(row, now));

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton label="Upcoming" active={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <TabButton label="Past" active={tab === 'past'} onPress={() => setTab('past')} />
      </View>
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={tab === 'upcoming' ? 'No upcoming consultations' : 'No past consultations'}
          description={tab === 'upcoming' ? 'Book a doctor below to see visits here.' : 'Completed visits appear here.'}
        />
      ) : (
        rows.map((row) => <ConsultationRow key={row.id} row={row} onOpenChat={onOpenChat} />)
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View style={styles.tabWrap}>
      <Button label={label} variant={active ? 'primary' : 'secondary'} onPress={onPress} />
    </View>
  );
}

// Booking state wins over clinical status, so an unpaid booking is never shown as scheduled.
function statusPill(row: ConsultationRowData): { label: string; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'neutral' } {
  if (row.booking_status === 'pending_payment') return { label: 'Awaiting payment', tone: 'amber' };
  if (row.status === 'cancelled' || row.booking_status === 'cancelled') return { label: 'Cancelled', tone: 'red' };
  if (row.status === 'completed') return { label: 'Completed', tone: 'emerald' };
  if (row.status === 'in_progress') return { label: 'In progress', tone: 'emerald' };
  return { label: 'Scheduled', tone: 'blue' };
}

function ConsultationRow({
  row,
  onOpenChat,
}: {
  row: ConsultationRowData;
  onOpenChat: (target: ChatTarget) => void;
}) {
  const badge = statusPill(row);
  const doctorName = row.profiles?.full_name ?? 'Your doctor';
  const followUpAvailable = row.status === 'completed';
  return (
    <Card>
      <View style={styles.rowHead}>
        <Text style={styles.doctor}>{doctorName}</Text>
        <Pill label={badge.label} tone={badge.tone} />
      </View>
      <Text style={[styles.meta, monoStyle]}>{formatIstDateTime(row.slot_start)} IST</Text>
      {row.chief_complaint ? <Text style={styles.complaint}>{row.chief_complaint}</Text> : null}
      {row.booking_status === 'pending_payment' ? <PayNowButton consultationId={row.id} doctorName={doctorName} /> : null}
      {followUpAvailable ? (
        <Button
          label="Follow-up chat"
          variant="secondary"
          onPress={() =>
            onOpenChat({
              consultationId: row.id,
              doctorId: row.doctor_id,
              doctorName,
              followupExpiresAt: row.followup_expires_at,
            })
          }
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  tabs: { flexDirection: 'row', gap: SPACE.sm },
  tabWrap: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  doctor: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  complaint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
});

function PayNowButton({ consultationId, doctorName }: { consultationId: string; doctorName: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const onPress = async () => {
    setBusy(true);
    setFailure(null);
    const outcome = await startCheckout({
      entityType: 'consultation',
      entityId: consultationId,
      description: `Consultation with ${doctorName}`,
    });
    setBusy(false);
    if (outcome.status === 'failed') setFailure(outcome.message);
  };
  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Button label="Pay now" busy={busy} onPress={() => void onPress()} />
    </>
  );
}
