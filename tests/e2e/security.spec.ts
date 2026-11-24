import { expect, test } from "@playwright/test";
import { accessToken, api } from "./support/api";
import { PERSONAS, PUBLISHABLE_KEY, SUPABASE_URL } from "./support/config";
import { lit, psql, script } from "./support/db";

const responseRows = <T>(body: unknown): T[] => {
  if (!Array.isArray(body)) throw new Error(`Expected a row array, received ${JSON.stringify(body)}`);
  return body as T[];
};

test.describe("Phase 1 security boundaries", () => {
  test("profiles and clinical records stay within the user's permitted scope", async () => {
    const [patientToken, doctorToken, adminToken] = await Promise.all([
      accessToken("patient"),
      accessToken("doctor"),
      accessToken("admin"),
    ]);

    const patientSeesDoctor = await api(patientToken, "GET", `/profiles?id=eq.${PERSONAS.doctor.id}&select=id`);
    expect(patientSeesDoctor.status).toBe(200);
    expect(responseRows(patientSeesDoctor.body)).toEqual([]);

    const patientSeesAdmin = await api(patientToken, "GET", `/profiles?id=eq.${PERSONAS.admin.id}&select=id`);
    expect(patientSeesAdmin.status).toBe(200);
    expect(responseRows(patientSeesAdmin.body)).toEqual([]);

    const consultationNames = await api(patientToken, "POST", "/rpc/get_consultation_practitioner_names", {
      p_consultation_ids: ["dddddddd-0000-4000-8000-000000000001"],
    });
    expect(consultationNames.status).toBe(200);
    expect(consultationNames.body).toEqual([
      { consultation_id: "dddddddd-0000-4000-8000-000000000001", full_name: "Dr. Arishta Sharma" },
    ]);

    const programDietitian = await api(patientToken, "POST", "/rpc/get_program_dietitian_name", {
      p_enrolment_id: "abababab-0000-4000-8000-000000000001",
    });
    expect(programDietitian.status).toBe(200);
    expect(programDietitian.body).toBe("Dr. Arishta Sharma");

    script(`update consultations set booking_status = 'pending_payment'
            where id = 'dddddddd-0000-4000-8000-000000000001';`);
    try {
      const doctorSeesPendingPatient = await api(
        doctorToken,
        "GET",
        `/profiles?id=eq.${PERSONAS.patient.id}&select=id,phone`,
      );
      expect(doctorSeesPendingPatient.status).toBe(200);
      expect(responseRows(doctorSeesPendingPatient.body)).toEqual([]);
    } finally {
      script(`update consultations set booking_status = 'confirmed'
              where id = 'dddddddd-0000-4000-8000-000000000001';`);
    }

    const doctorSeesAssignedPatient = await api(doctorToken, "GET", `/profiles?id=eq.${PERSONAS.patient.id}&select=id`);
    expect(doctorSeesAssignedPatient.status).toBe(200);
    expect(responseRows(doctorSeesAssignedPatient.body)).toEqual([{ id: PERSONAS.patient.id }]);

    const doctorSeesAdmin = await api(doctorToken, "GET", `/profiles?id=eq.${PERSONAS.admin.id}&select=id`);
    expect(doctorSeesAdmin.status).toBe(200);
    expect(responseRows(doctorSeesAdmin.body)).toEqual([]);

    const marker = `phase1-rls-${Date.now()}`;
    const inserted = await api(adminToken, "POST", "/diagnostic_reports", {
      patient_id: PERSONAS.admin.id,
      report_title: marker,
      file_url: `synthetic://${marker}`,
      file_type: "application/pdf",
    });
    expect(inserted.status).toBe(201);
    const report = responseRows<{ id: string }>(inserted.body)[0];
    expect(report?.id).toBeTruthy();

    try {
      const patientReadsOtherReport = await api(
        patientToken,
        "GET",
        `/diagnostic_reports?id=eq.${report.id}&select=id`,
      );
      expect(patientReadsOtherReport.status).toBe(200);
      expect(responseRows(patientReadsOtherReport.body)).toEqual([]);
    } finally {
      const cleanup = await api(adminToken, "DELETE", `/diagnostic_reports?id=eq.${report.id}`);
      expect(cleanup.status).toBe(200);
    }
  });

  test("a patient cannot register a push token for another account", async () => {
    const patientToken = await accessToken("patient");
    const result = await api(patientToken, "POST", "/patient_push_tokens", {
      user_id: PERSONAS.doctor.id,
      expo_push_token: `ExponentPushToken[phase1-security-${Date.now()}]`,
    });

    expect(result.status).not.toBe(201);
    expect(JSON.stringify(result.body)).toMatch(/row-level security|policy|permission|not allowed/i);
  });

  test("private medical and diet files are scoped to the patient and use short-lived links", async () => {
    const [patientToken, doctorToken, adminToken] = await Promise.all([
      accessToken("patient"),
      accessToken("doctor"),
      accessToken("admin"),
    ]);
    const recordPath = `${PERSONAS.patient.id}/phase1-security-check-${Date.now()}.pdf`;
    const dietPath = `${PERSONAS.patient.id}/meals/phase1-diet-check-${Date.now()}.jpg`;
    const headers = { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${patientToken}` };

    expect(psql("select bool_and(NOT public)::text from storage.buckets where id in ('medical-records', 'diet-charts')")).toBe("true");
    expect(
      psql(`
        select count(*) from storage.buckets
        where file_size_limit = 10485760
          and ((id in ('medical-records', 'patient-reports')
                and allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png']
                and cardinality(allowed_mime_types) = 3)
            or (id = 'diet-charts'
                and allowed_mime_types @> ARRAY['image/jpeg', 'image/png']
                and cardinality(allowed_mime_types) = 2))
      `),
    ).toBe("3");

    const unsupportedUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/diet-charts/${dietPath}.txt`, {
      method: "POST",
      headers: { ...headers, "content-type": "text/plain" },
      body: "This file type is not accepted by the private diet chart bucket.",
    });
    expect(unsupportedUpload.status).not.toBe(200);
    expect(unsupportedUpload.status).not.toBe(201);

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${recordPath}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/pdf" },
      body: "%PDF-1.4\nSynthetic access-control fixture. No patient information.\n%%EOF",
    });
    expect([200, 201]).toContain(upload.status);

    const patientRead = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/medical-records/${recordPath}`, {
      headers,
    });
    expect(patientRead.status).toBe(200);
    await patientRead.arrayBuffer();

    const adminRead = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/medical-records/${recordPath}`, {
      headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${adminToken}` },
    });
    expect(adminRead.status).not.toBe(200);

    const dietUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/diet-charts/${dietPath}`, {
      method: "POST",
      headers: { ...headers, "content-type": "image/jpeg" },
      body: "Synthetic meal-photo access-control fixture. No patient information.",
    });
    expect([200, 201]).toContain(dietUpload.status);

    const practitionerRead = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/diet-charts/${dietPath}`, {
      headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${doctorToken}` },
    });
    expect(practitionerRead.status).toBe(200);
    await practitionerRead.arrayBuffer();

    const attachment = await api(patientToken, "POST", "/program_messages", {
      enrolment_id: "abababab-0000-4000-8000-000000000001",
      sender_id: PERSONAS.patient.id,
      content: "Synthetic E2E meal photo.",
      attachment_url: dietPath,
      is_meal_photo: true,
    });
    expect(attachment.status).toBe(201);
    const attachmentId = responseRows<{ id: string }>(attachment.body)[0]?.id;
    expect(attachmentId).toBeTruthy();

    const cannotDeleteReferencedPhoto = await fetch(`${SUPABASE_URL}/storage/v1/object/diet-charts/${dietPath}`, {
      method: "DELETE",
      headers,
    });
    expect(cannotDeleteReferencedPhoto.status).not.toBe(200);
    expect(cannotDeleteReferencedPhoto.status).not.toBe(204);
    expect(psql(`select count(*) from storage.objects where bucket_id = 'diet-charts' and name = ${lit(dietPath)}`)).toBe("1");

    const removeFixture = await api(adminToken, "DELETE", `/program_messages?id=eq.${attachmentId}`);
    expect(removeFixture.status).toBe(200);
    const removeUnreferencedPhoto = await fetch(`${SUPABASE_URL}/storage/v1/object/diet-charts/${dietPath}`, {
      method: "DELETE",
      headers,
    });
    expect(removeUnreferencedPhoto.status, await removeUnreferencedPhoto.clone().text()).toBe(200);
    expect(psql(`select count(*) from storage.objects where bucket_id = 'diet-charts' and name = ${lit(dietPath)}`)).toBe("0");

    const signed = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/medical-records/${recordPath}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    expect(signed.status).toBe(200);
    const signedBody = (await signed.json()) as { signedURL?: string };
    expect(signedBody.signedURL).toBeTruthy();
    const signedUrl = new URL(signedBody.signedURL!, SUPABASE_URL);
    const token = signedUrl.searchParams.get("token");
    expect(token).toBeTruthy();
    const payload = JSON.parse(Buffer.from(token!.split(".")[1]!, "base64url").toString("utf8")) as { exp?: number };
    expect(payload.exp).toBeTruthy();
    const remainingSeconds = payload.exp! - Math.floor(Date.now() / 1000);
    expect(remainingSeconds).toBeGreaterThan(0);
    expect(remainingSeconds).toBeLessThanOrEqual(60);
  });

  test("only an admin may resolve erasure and refund reviews", async () => {
    const patientToken = await accessToken("patient");
    const erasure = await api(patientToken, "POST", "/rpc/resolve_erasure_request", {
      p_request_id: "ffffffff-0000-4000-8000-000000000001",
    });
    expect(erasure.status).toBe(400);
    expect(JSON.stringify(erasure.body)).toContain("Only administrators may resolve erasure requests");

    const refund = await api(patientToken, "POST", "/rpc/record_payment_refund_review", {
      p_gateway_payment_id: "pay_NkQ7mCap1Xw2Lr",
      p_refund_id: `refund_e2e_forbidden_${Date.now()}`,
    });
    expect(refund.status).toBe(400);
    expect(JSON.stringify(refund.body)).toContain("Only admins can resolve payment refund reviews");
  });
});
