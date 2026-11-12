import { supabase } from "./supabase";

// Records live in a private bucket. Each link lasts 60 seconds, as medical files must.
export const RECORD_BUCKET = "patient-reports";
export const RECORD_LINK_SECONDS = 60;

export const createRecordLink = async (filePath: string): Promise<string> => {
  const { data, error } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(filePath, RECORD_LINK_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
};
