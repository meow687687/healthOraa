import { supabase } from "./supabase";

// Records live in a private bucket. Each link lasts 60 seconds, as medical files must.
export const RECORD_BUCKET = "medical-records";
export const LEGACY_RECORD_BUCKET = "patient-reports";
export const RECORD_LINK_SECONDS = 60;

export const createRecordLink = async (
  filePath: string,
  downloadName?: string,
): Promise<string> => {
  const options = downloadName ? { download: downloadName } : undefined;
  const { data, error } = await supabase.storage
    .from(RECORD_BUCKET)
    .createSignedUrl(filePath, RECORD_LINK_SECONDS, options);
  if (!error && data) return data.signedUrl;
  const legacy = await supabase.storage
    .from(LEGACY_RECORD_BUCKET)
    .createSignedUrl(filePath, RECORD_LINK_SECONDS, options);
  if (legacy.error || !legacy.data) {
    throw new Error(
      legacy.error?.message ??
        error?.message ??
        "The file link could not be created.",
    );
  }
  return legacy.data.signedUrl;
};
