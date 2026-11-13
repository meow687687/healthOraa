import { useMutation, useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { RECORD_BUCKET, RECORD_LINK_SECONDS } from '../../lib/records';
import { useAuth } from '../../auth/AuthProvider';

export const useProfile = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase.from('profiles').select('full_name, phone').eq('id', userId).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
};

export const useHealthLocker = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['locker', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('patient_documents')
        .select('id, title, category, document_date, file_path, mime_type')
        .eq('patient_id', userId)
        .order('document_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
};

// Opens a locker file through a link that expires after 60 seconds. A new link is made for each open.
export const openLockerDocument = async (filePath: string | null): Promise<void> => {
  if (!filePath) throw new Error('No file is attached to this record.');
  const { data, error } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(filePath, RECORD_LINK_SECONDS);
  if (error || !data) throw new Error('The document link could not be created. Try again.');
  await WebBrowser.openBrowserAsync(data.signedUrl);
};

// Deletes the patient's login, personal details and uploaded records through the delete-account function.
// Clinical and order records are kept without the patient's name, as clinical and tax rules require.
export const useDeleteAccount = () =>
  useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (!error) return;
      let message = 'Account deletion failed. Try again or contact support.';
      if (error instanceof FunctionsHttpError) {
        const body = (await error.context.json().catch(() => null)) as { error?: string } | null;
        if (body?.error) message = body.error;
      }
      throw new Error(message);
    },
  });
