import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { patientIntakeSchema } from '@healthoraa/validation';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Button, Card, ErrorBox, LabelLine, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { formatPaise, gstOn, rupeesToPaise } from '../../lib/money';
import { startCheckout } from '../../lib/payments';
import { formatIstDate, formatIstTime, istDayKey, istHour } from '../../lib/time';
import type { PractitionerView } from './DoctorCard';
import { useBookConsultation, useDoctorSlots, type BookingResult } from './queries';

type Step = 'slot' | 'intake' | 'review' | 'payment';

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
}

// Booking runs in four steps: pick a slot, describe the concern, review the amount, then pay.
export function BookingSheet({
  doctor,
  onClose,
}: {
  doctor: PractitionerView | null;
  onClose: () => void;
}) {
  return (
    <Sheet visible={doctor !== null} title={doctor ? `Book with ${doctor.full_name}` : ''} onClose={onClose}>
      {doctor ? <BookingFlow key={doctor.id} doctor={doctor} onClose={onClose} /> : null}
    </Sheet>
  );
}

function BookingFlow({ doctor, onClose }: { doctor: PractitionerView; onClose: () => void }) {
  const slots = useDoctorSlots(doctor.id);
  const booking = useBookConsultation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('slot');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [complaint, setComplaint] = useState('');
  const [complaintError, setComplaintError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const feePaise = rupeesToPaise(Number(doctor.consultation_fee_inr));
  const previewTotal = feePaise + gstOn(feePaise);

  const confirmBooking = async () => {
    if (!slot) return;
    setFailure(null);
    try {
      const booked = await booking.mutateAsync({ slotId: slot.id, complaint: complaint.trim() });
      setResult(booked);
      setStep('payment');
    } catch (error) {
      // A slot can be taken between selection and confirmation. Send the patient back to choose again.
      setFailure(error instanceof Error ? error.message : 'The booking failed. Try again.');
      setStep('slot');
      setSlot(null);
      void queryClient.invalidateQueries({ queryKey: ['slots', doctor.id] });
    }
  };

  const onPay = async () => {
    if (!result) return;
    setPaymentError(null);
    setPaymentNote(null);
    const outcome = await startCheckout({
      entityType: 'consultation',
      entityId: result.consultationId,
      description: `Consultation with ${doctor.full_name}`,
    });
    if (outcome.status === 'submitted') {
      setPaymentNote('Payment submitted. The slot is confirmed once Razorpay reports the payment as captured.');
    } else if (outcome.status === 'cancelled') {
      setPaymentNote('Payment cancelled. The slot stays booked as awaiting payment until you pay from your consultations.');
    } else if (outcome.status === 'failed') {
      setPaymentError(outcome.message);
    }
  };

  if (step === 'slot') {
    return (
      <>
        {failure ? <ErrorBox message={failure} /> : null}
        <Text style={styles.note}>
          {doctor.slot_duration_minutes}-minute consultation · {formatPaise(feePaise)} plus GST
        </Text>
        {slots.isPending ? <Skeleton height={160} /> : null}
        {slots.isError ? <ErrorBox message={slots.error.message} /> : null}
        {slots.data && slots.data.length === 0 ? (
          <Text style={styles.note}>No open slots right now. Check back later.</Text>
        ) : null}
        {slots.data && slots.data.length > 0 ? (
          <SlotPicker
            slots={slots.data}
            selected={slot}
            onSelect={setSlot}
          />
        ) : null}
        <Button label="Continue to intake" disabled={!slot} onPress={() => setStep('intake')} />
      </>
    );
  }

  if (step === 'intake') {
    const onContinue = () => {
      const parsed = patientIntakeSchema.pick({ chief_complaint: true }).safeParse({ chief_complaint: complaint });
      if (!parsed.success) {
        setComplaintError(parsed.error.issues[0]?.message ?? 'Describe your concern.');
        return;
      }
      setComplaintError(null);
      setStep('review');
    };
    return (
      <>
        <Text style={styles.note}>Describe what you would like to discuss with the doctor.</Text>
        <TextField
          label="Main concern"
          value={complaint}
          onChangeText={setComplaint}
          multiline
          maxLength={1000}
          error={complaintError ?? undefined}
          placeholder="For example: irregular cycles and acne for three months"
        />
        <Button label="Continue to summary" onPress={onContinue} />
        <Button label="Back" variant="secondary" onPress={() => setStep('slot')} />
      </>
    );
  }

  if (step === 'review') {
    return (
      <>
        {failure ? <ErrorBox message={failure} /> : null}
        <Card>
          <LabelLine label="Doctor" value={doctor.full_name} />
          <LabelLine label="Slot" value={slot ? `${formatIstDate(slot.start_time)}, ${formatIstTime(slot.start_time)} IST` : ''} />
          <LabelLine label="Consultation fee" value={formatPaise(feePaise)} />
          <LabelLine label="GST (18%)" value={formatPaise(gstOn(feePaise))} />
          <LabelLine label="Total" value={formatPaise(previewTotal)} strong />
        </Card>
        <Text style={styles.note}>The final amount is set by the server when the booking is created.</Text>
        <Button label={`Confirm and pay ${formatPaise(previewTotal)}`} busy={booking.isPending} onPress={() => void confirmBooking()} />
        <Button label="Back" variant="secondary" onPress={() => setStep('intake')} />
      </>
    );
  }

  return (
    <>
      <Card>
        <Pill label="Booking held" tone="amber" />
        <LabelLine label="Total incl. GST" value={formatPaise(result?.totalPaise ?? 0)} strong />
        <Text style={styles.note}>Order reference {result?.orderId}</Text>
      </Card>
      {paymentError ? <ErrorBox message={paymentError} /> : null}
      {paymentNote ? <Text style={styles.note}>{paymentNote}</Text> : null}
      <Button label={`Pay ${formatPaise(result?.totalPaise ?? 0)} with Razorpay`} onPress={() => void onPay()} />
      <Button label="Done" variant="secondary" onPress={onClose} />
    </>
  );
}

// Slots grouped by IST day, then into Morning, Afternoon and Evening.
function SlotPicker({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
  const days = useMemo(() => {
    const keys = [...new Set(slots.map((slot) => istDayKey(slot.start_time)))];
    return keys.slice(0, 14);
  }, [slots]);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const activeDay = dayKey && days.includes(dayKey) ? dayKey : days[0];
  const daySlots = slots.filter((slot) => istDayKey(slot.start_time) === activeDay);

  const blocks = [
    { title: 'Morning', items: daySlots.filter((slot) => istHour(slot.start_time) < 12) },
    { title: 'Afternoon', items: daySlots.filter((slot) => istHour(slot.start_time) >= 12 && istHour(slot.start_time) < 17) },
    { title: 'Evening', items: daySlots.filter((slot) => istHour(slot.start_time) >= 17) },
  ];

  return (
    <View style={styles.picker}>
      <View style={styles.days}>
        {days.map((key) => {
          const first = slots.find((slot) => istDayKey(slot.start_time) === key);
          const active = key === activeDay;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setDayKey(key)}
              style={[styles.dayChip, active ? styles.dayChipActive : null]}
            >
              <Text style={[styles.dayText, active ? styles.dayTextActive : null]}>
                {first ? formatIstDate(first.start_time) : key}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {blocks.map((block) =>
        block.items.length === 0 ? null : (
          <View key={block.title} style={styles.block}>
            <Text style={styles.blockTitle}>{block.title}</Text>
            <View style={styles.chips}>
              {block.items.map((slot) => {
                const on = selected?.id === slot.id;
                return (
                  <Pressable
                    key={slot.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => onSelect(slot)}
                    style={[styles.chip, on ? styles.chipOn : null]}
                  >
                    <Text style={[styles.chipText, monoStyle, on ? styles.chipTextOn : null]}>
                      {formatIstTime(slot.start_time)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  picker: { gap: SPACE.md },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  dayChip: {
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
  },
  dayChipActive: { backgroundColor: COLORS.accentBlue, borderColor: COLORS.accentBlue },
  dayText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  dayTextActive: { color: COLORS.textPrimary },
  block: { gap: SPACE.sm },
  blockTitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
    paddingHorizontal: SPACE.md,
  },
  chipOn: { backgroundColor: COLORS.accentBlueGlow, borderColor: COLORS.accentBlue },
  chipText: { color: COLORS.textSecondary, fontSize: 14 },
  chipTextOn: { color: COLORS.textPrimary },
});
