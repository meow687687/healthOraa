import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-service account deletion for patients (App Store and Play Store requirement).
//
// Removed: the login, name, phone, avatar, health-locker files and their rows, and saved cart lines.
// Kept, without the patient's name: consultations, prescriptions, intake forms, diagnostic reports and orders.
// Clinical and tax rules require those records, so they are not deleted here.
//
// The login is soft-deleted (GoTrue keeps the row), so the profile foreign keys do not cascade.

const RECORD_BUCKET = "patient-reports";

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const token = bearerToken(request);
  if (!token) return json({ error: "Sign in again to delete your account." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "The server is not configured." }, 500);

  // The caller is identified from their own token. The service role is used only after that check.
  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sign in again to delete your account." }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "We could not load your account. Try again." }, 500);
  // Practitioner and admin accounts hold clinical and audit records. They go through a separate process.
  if (profile.role !== "patient") {
    return json({ error: "This account cannot be deleted from the app. Contact support." }, 403);
  }

  // First write: the account is blocked from this moment. current_user_role() returns no role for a deleted
  // profile, so every role-based policy refuses the account on its next request, even before the token expires.
  const { error: blockError } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), expo_push_token: null })
    .eq("id", userId);
  if (blockError) return json({ error: "Your account was not deleted. Try again." }, 500);

  const { data: documents, error: documentsError } = await admin
    .from("patient_documents")
    .select("file_path")
    .eq("patient_id", userId);
  if (documentsError) return json({ error: "Your account was not deleted. Try again." }, 500);

  const paths = (documents ?? []).map((row) => row.file_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from(RECORD_BUCKET).remove(paths);
    if (storageError) return json({ error: "Your files could not be removed. Your account was not deleted." }, 500);
  }

  const cleanup = [
    admin.from("patient_biomarkers").delete().eq("patient_id", userId),
    admin.from("patient_documents").delete().eq("patient_id", userId),
    admin.from("cart_items").delete().eq("patient_id", userId),
  ];
  for (const step of cleanup) {
    const { error } = await step;
    if (error) return json({ error: "Your account was not fully deleted. Try again." }, 500);
  }

  // Clinical and order rows keep the profile id, so the profile row stays and only its identity fields are cleared.
  const { error: anonymiseError } = await admin
    .from("profiles")
    .update({ full_name: "Deleted patient", phone: null, avatar_url: null, expo_push_token: null })
    .eq("id", userId);
  if (anonymiseError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  // Replace the login email first, so the old address is no longer attached to the retained auth row.
  const { error: emailError } = await admin.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@deleted.invalid`,
  });
  if (emailError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  // Revoke every session for this account. Without this, an access token issued before deletion keeps working
  // until it expires.
  const { error: signOutError } = await admin.auth.admin.signOut(token, "global");
  if (signOutError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  return json({ deleted: true }, 200);
});
