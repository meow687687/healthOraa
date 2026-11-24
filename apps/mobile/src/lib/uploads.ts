import { supabase } from './supabase';
import { DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from '@healthoraa/validation';
import { DIET_CHART_BUCKET, LEGACY_RECORD_BUCKET, RECORD_BUCKET, RECORD_LINK_SECONDS } from './records';

// Uploads a picked file (a local file:// or content:// URI) into the patient's private folder.
// Paths always start with the patient's user id, which is what the storage policies check.
export async function uploadRecordFile(
  path: string,
  uri: string,
  contentType: string,
  bucket: typeof RECORD_BUCKET | typeof DIET_CHART_BUCKET = RECORD_BUCKET,
): Promise<void> {
  const acceptedTypes: readonly string[] = bucket === DIET_CHART_BUCKET
    ? ['image/jpeg', 'image/png']
    : DOCUMENT_ACCEPTED_TYPES;
  if (!acceptedTypes.includes(contentType)) throw new Error('This file type is not supported.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error('The selected file could not be read. Choose it again and retry.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected file is empty.');
  if (bytes.byteLength > DOCUMENT_MAX_BYTES) throw new Error('Files must be 10 MB or smaller.');
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`The file could not be uploaded: ${error.message}`);
}

export async function signedRecordUrl(
  path: string,
  bucket: typeof RECORD_BUCKET | typeof DIET_CHART_BUCKET = RECORD_BUCKET,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, RECORD_LINK_SECONDS);
  if (!error && data) return data.signedUrl;

  const legacy = await supabase.storage.from(LEGACY_RECORD_BUCKET).createSignedUrl(path, RECORD_LINK_SECONDS);
  if (legacy.error || !legacy.data) throw new Error('The file link could not be created. Try again.');
  return legacy.data.signedUrl;
}

// A file name that is safe inside a storage path.
export const safeFileName = (name: string): string => name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
