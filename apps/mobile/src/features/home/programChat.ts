import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { programMessageSchema } from '@healthoraa/validation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';

export interface ProgramMessageRow {
  id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  is_meal_photo: boolean;
  created_at: string;
}

export const useProgramMessages = (enrolmentId: string) =>
  useQuery({
    queryKey: ['program-messages', enrolmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_messages')
        .select('id, sender_id, content, attachment_url, is_meal_photo, created_at')
        .eq('enrolment_id', enrolmentId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });

// Text, a meal photo, or both. The database accepts writes only while the programme is active.
export const useSendProgramMessage = (enrolmentId: string) => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; attachmentPath: string | null }) => {
      if (!userId) throw new Error('Not signed in');
      const trimmed = input.text.trim();
      if (trimmed.length > 0) {
        const parsed = programMessageSchema.safeParse({ content: trimmed });
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your message.');
      }
      const { error } = await supabase.from('program_messages').insert({
        enrolment_id: enrolmentId,
        sender_id: userId,
        content: trimmed.length > 0 ? trimmed : null,
        attachment_url: input.attachmentPath,
        is_meal_photo: input.attachmentPath !== null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['program-messages', enrolmentId] });
    },
  });
};
