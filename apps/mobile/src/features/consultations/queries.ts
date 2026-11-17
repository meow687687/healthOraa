import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consultationMessageSchema } from '@healthoraa/validation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';

// Verified, active practitioners, through the restricted listing function. Contact details are not returned.
export const usePractitioners = () =>
  useQuery({
    queryKey: ['practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_verified_practitioners');
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const useMyConsultations = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['consultations', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('consultations')
        .select(
          'id, doctor_id, slot_start, slot_end, status, booking_status, chief_complaint, followup_expires_at, profiles!consultations_doctor_id_fkey(full_name)',
        )
        .eq('patient_id', userId)
        .order('slot_start', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
};

// Open slots for one practitioner, from now on. Booked and held slots never appear.
export const useDoctorSlots = (doctorId: string | null) =>
  useQuery({
    queryKey: ['slots', doctorId],
    enabled: doctorId !== null,
    queryFn: async () => {
      if (!doctorId) throw new Error('No practitioner selected');
      const { data, error } = await supabase
        .from('consultation_slots')
        .select('id, start_time, end_time')
        .eq('practitioner_id', doctorId)
        .eq('is_booked', false)
        .gt('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(400);
      if (error) throw new Error(error.message);
      return data;
    },
  });

export interface BookingResult {
  consultationId: string;
  orderId: string;
  feePaise: number;
  gstPaise: number;
  totalPaise: number;
}

// Holds the slot and creates the order. The fee and GST are computed on the server from the practitioner's profile.
export const useBookConsultation = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { slotId: string; complaint: string }): Promise<BookingResult> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase.rpc('initiate_consultation_booking', {
        p_slot_id: input.slotId,
        p_patient_id: userId,
        p_chief_complaint: input.complaint,
      });
      if (error) throw new Error(error.message);
      const row = data?.[0];
      if (!row) throw new Error('The booking did not return an order. Try again.');
      return {
        consultationId: row.consultation_row.id,
        orderId: row.order_id,
        feePaise: row.fee_paise,
        gstPaise: row.gst_paise,
        totalPaise: row.total_paise,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultations', userId] });
    },
  });
};

export const useConsultationMessages = (consultationId: string) =>
  useQuery({
    queryKey: ['consultation-messages', consultationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_messages')
        .select('id, sender_id, content, created_at')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });

// The database rejects inserts after the 7-day window, so an expired chat cannot be written to from here either.
export const useSendConsultationMessage = (consultationId: string) => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!userId) throw new Error('Not signed in');
      const parsed = consultationMessageSchema.safeParse({ content: text });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your message.');
      const { error } = await supabase.from('consultation_messages').insert({
        consultation_id: consultationId,
        sender_id: userId,
        content: parsed.data.content,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-messages', consultationId] });
    },
  });
};
