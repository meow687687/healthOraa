import { supabase } from "../../lib/supabase";

export type ExportPacket = {
  generated_at: string;
  subject_user_id: string;
  profile: { full_name: string; role: string; created_at: string } | null;
  orders: unknown[];
  consultations: unknown[];
  consultation_messages: unknown[];
  program_enrolments: unknown[];
  program_messages: unknown[];
};

// Columns that identify the subject or other people and are not needed for the
// subject's own access request. Row IDs are kept so the packet can be cross-referenced.
const STRIP_KEYS = new Set([
  "phone",
  "avatar_url",
  "shipping_address",
  "gateway_order_id",
  "gateway_payment_id",
  "sender_id",
]);

const sanitize = (row: unknown): unknown => {
  if (row === null || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (STRIP_KEYS.has(key)) continue;
    out[key] = sanitize(value);
  }
  return out;
};

const fetchOrders = async (userId: string) => {
  const { data, error } = await supabase.from("orders").select("*").eq("customer_id", userId);
  if (error) throw new Error(`Could not read orders: ${error.message}`);
  return data ?? [];
};

const fetchConsultations = async (userId: string) => {
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("patient_id", userId);
  if (error) throw new Error(`Could not read consultations: ${error.message}`);
  return data ?? [];
};

const fetchEnrolments = async (userId: string) => {
  const { data, error } = await supabase
    .from("program_enrolments")
    .select("*")
    .eq("patient_id", userId);
  if (error) throw new Error(`Could not read program enrolments: ${error.message}`);
  return data ?? [];
};

export const buildExportPacket = async (userId: string): Promise<ExportPacket> => {
  const [profileRes, orders, consultations, enrolments] = await Promise.all([
    supabase.from("profiles").select("full_name, role, created_at").eq("id", userId).maybeSingle(),
    fetchOrders(userId),
    fetchConsultations(userId),
    fetchEnrolments(userId),
  ]);

  if (profileRes.error) throw new Error(`Could not read profile: ${profileRes.error.message}`);

  const consultationIds = consultations.map((c) => c.id);
  const enrolmentIds = enrolments.map((e) => e.id);

  const [consultationMessages, programMessages] = await Promise.all([
    consultationIds.length
      ? supabase.from("consultation_messages").select("*").in("consultation_id", consultationIds)
      : Promise.resolve({ data: [], error: null }),
    enrolmentIds.length
      ? supabase.from("program_messages").select("*").in("enrolment_id", enrolmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (consultationMessages.error) throw new Error(consultationMessages.error.message);
  if (programMessages.error) throw new Error(programMessages.error.message);

  return sanitize({
    generated_at: new Date().toISOString(),
    subject_user_id: userId,
    profile: profileRes.data,
    orders,
    consultations,
    consultation_messages: consultationMessages.data ?? [],
    program_enrolments: enrolments,
    program_messages: programMessages.data ?? [],
  }) as ExportPacket;
};

export const downloadJson = (packet: ExportPacket, filename: string): void => {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
