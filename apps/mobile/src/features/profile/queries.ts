import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { safeFileName, signedRecordUrl, uploadRecordFile } from '../../lib/uploads';
import { functionErrorMessage } from '../../lib/functionError';
import { RECORD_BUCKET } from '../../lib/records';
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
  const signedUrl = await signedRecordUrl(filePath);
  await WebBrowser.openBrowserAsync(signedUrl);
};

// Deletes the patient's login, personal details and uploaded records through the delete-account function.
// Clinical and order records are kept without the patient's name, as clinical and tax rules require.
export const useDeleteAccount = () =>
  useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw new Error(await functionErrorMessage(error, 'Account deletion failed. Try again or contact support.'));
    },
  });

export const useOrders = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['orders', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, status, total_amount_inr, tracking_number, order_items(quantity, unit_price_inr, products(title))')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
};

export interface LockerUpload {
  title: string;
  category: 'blood_panel' | 'imaging_radiology' | 'prescription' | 'discharge_summary' | 'other';
  documentDate: string;
  file: { uri: string; name: string; size: number | null; mimeType: string };
}

// Uploads the file to the patient's folder, then records the document. Remove the private upload only after
// Postgres returns a definitive rejection; transport errors can have an unknown commit outcome.
export const useUploadLockerDocument = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LockerUpload) => {
      if (!userId) throw new Error('Not signed in');
      const path = `${userId}/locker/${Date.now()}-${safeFileName(input.file.name)}`;
      await uploadRecordFile(path, input.file.uri, input.file.mimeType);
      const { error } = await supabase.from('patient_documents').insert({
        patient_id: userId,
        title: input.title,
        category: input.category,
        document_date: input.documentDate,
        file_path: path,
        file_size_bytes: input.file.size,
        mime_type: input.file.mimeType,
        is_verified: false,
      });
      if (error) {
        const { data: savedDocument, error: verificationError } = await supabase
          .from('patient_documents')
          .select('id')
          .eq('patient_id', userId)
          .eq('file_path', path)
          .maybeSingle();
        if (savedDocument) return;
        if (verificationError) {
          throw new Error('We could not confirm whether the document was saved. Refresh your Health Locker before trying again.');
        }
        if (!/^[0-9A-Z]{5}$/.test(error.code ?? '') || error.code.startsWith('PGRST')) {
          throw new Error('We could not confirm whether the document was saved. Refresh your Health Locker before trying again.');
        }

        let cleanupFailed = false;
        try {
          const { error: cleanupError } = await supabase.storage.from(RECORD_BUCKET).remove([path]);
          cleanupFailed = Boolean(cleanupError);
        } catch {
          cleanupFailed = true;
        }
        const cleanupMessage = cleanupFailed
          ? ' The private file could not be removed; contact support if it remains in your Health Locker.'
          : '';
        throw new Error(`The document could not be recorded: ${error.message}.${cleanupMessage}`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['locker', userId] });
    },
  });
};
