import { supabase } from './supabase';
import { RECORD_BUCKET, RECORD_LINK_SECONDS } from './records';

// Uploads a picked file (a local file:// or content:// URI) into the patient's private folder.
// Paths always start with the patient's user id, which is what the storage policies check.
export async function uploadRecordFile(path: string, uri: string, contentType: string): Promise<void> {
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const { error } = await supabase.storage.from(RECORD_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`The file could not be uploaded: ${error.message}`);
}

export async function signedRecordUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(path, RECORD_LINK_SECONDS);
  if (error || !data) throw new Error('The file link could not be created. Try again.');
  return data.signedUrl;
}

// A file name that is safe inside a storage path.
export const safeFileName = (name: string): string => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
