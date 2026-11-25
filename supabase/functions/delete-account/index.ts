import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-service account deletion for patients (App Store and Play Store requirement).
//
// Removed: the login, identity fields, health-locker files, program meal photos, and saved cart lines.
// Kept, without the patient's name: consultations, prescriptions, intake forms, diagnostic reports and orders.
// Clinical and tax rules require those records, so they are not deleted here.
//
// The login is soft-deleted (GoTrue keeps the row), so the profile foreign keys do not cascade.

const RECORD_BUCKETS = ["medical-records", "patient-reports"] as const;
const RECORD_FOLDERS = ["locker", "health-locker"] as const;
const DIET_CHART_BUCKET = "diet-charts";
const MEAL_BUCKETS = [DIET_CHART_BUCKET, "patient-reports"] as const;
const STORAGE_OBJECT_PAGE_SIZE = 1000;

const json = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
};

const verifiedOwnedPaths = (rows: unknown[], userId: string, bucket: string, folder: string): string[] => {
  const paths: string[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
    const object = row as Record<string, unknown>;
    if (object.bucket_id !== bucket || typeof object.name !== "string") continue;
    const parts = object.name.split("/");
    if (parts.length !== 3 || parts[0] !== userId || parts[1] !== folder) continue;
    if (parts.some((part) => part === "." || part === "..")) continue;
    paths.push(object.name);
  }
  return paths;
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

  const removeOwnedFiles = async (
    rpcName: "list_patient_owned_record_objects" | "list_patient_owned_meal_objects",
    buckets: readonly string[],
    folders: readonly string[],
  ): Promise<string | null> => {
    for (const bucket of buckets) {
      for (const folder of folders) {
        let previousPage = "";
        while (true) {
          const { data, error } = await admin.rpc(rpcName, { p_patient_id: userId })
            .eq("bucket_id", bucket)
            .like("name", `${userId}/${folder}/%`)
            .order("name", { ascending: true })
            .range(0, STORAGE_OBJECT_PAGE_SIZE - 1);
          if (error) return error.message;

          const rows = (data ?? []) as unknown[];
          if (rows.length === 0) break;

          const paths = verifiedOwnedPaths(rows, userId, bucket, folder);
          if (paths.length !== rows.length) return "The file list included an unexpected storage path.";
          const pageKey = paths.join("\u0000");
          if (pageKey === previousPage) return "The storage cleanup did not remove the requested files.";
          previousPage = pageKey;

          for (let start = 0; start < paths.length; start += 100) {
            const { error: storageError } = await admin.storage.from(bucket).remove(paths.slice(start, start + 100));
            if (storageError) return storageError.message;
          }
        }
      }
    }
    return null;
  };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "We could not load your account. Try again." }, 500);
  // Practitioner and admin accounts hold clinical and audit records. They go through a separate process.
  if (profile.role !== "patient") {
    return json({ error: "This account cannot be deleted from the app. Contact support." }, 403);
  }

  // Block access, remove the token, and cancel queued alerts atomically. The push worker takes
  // compatible profile/token locks while claiming a delivery, so a stale pre-read cannot authorize a send.
  const { data: pushBlocked, error: blockError } = await admin.rpc("block_patient_push_delivery", {
    p_patient_id: userId,
  });
  if (blockError) {
    return json({ error: "Your account was not deleted. Try again." }, 500);
  }
  if (pushBlocked !== true) {
    return json({ error: "A notification is still in progress. Wait for it to finish, then retry account deletion." }, 409);
  }

  // Ownership comes from storage metadata, not client-writable patient_documents.file_path values.
  const recordCleanupError = await removeOwnedFiles("list_patient_owned_record_objects", RECORD_BUCKETS, RECORD_FOLDERS);
  if (recordCleanupError) return json({ error: "Your files could not be removed. Your account was not deleted." }, 500);

  const mealCleanupError = await removeOwnedFiles("list_patient_owned_meal_objects", MEAL_BUCKETS, ["meals"]);
  if (mealCleanupError) return json({ error: "Your files could not be removed. Your account was not deleted." }, 500);

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
    .update({ full_name: "Deleted patient", phone: null, avatar_url: null })
    .eq("id", userId);
  if (anonymiseError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  // Replace the login email first, so the old address is no longer attached to the retained auth row.
  const { error: emailError } = await admin.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@deleted.invalid`,
  });
  if (emailError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) return json({ error: "Your account was not fully deleted. Try again." }, 500);

  // Revoke any remaining sessions only after deletion succeeds. If deleteUser fails, the valid session can
  // refresh its access token and retry against the already-blocked, idempotent cleanup state.
  try {
    await admin.auth.admin.signOut(token, "global");
  } catch {
    // The profile is already blocked and its device tokens are removed, so remote sign-out is best-effort here.
  }

  return json({ deleted: true }, 200);
});
