import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import { RECORD_BUCKET, RECORD_LINK_SECONDS } from '../../lib/records';
import { functionErrorMessage } from '../../lib/functionError';
import { uploadRecordFile, safeFileName } from '../../lib/uploads';
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

// Uploads the file to the patient's folder, then records the document. If the record fails, the file is left
// in the private folder and no link to it is shown, so the patient can retry.
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
      if (error) throw new Error(`The document was uploaded but not recorded: ${error.message}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['locker', userId] });
    },
  });
};
