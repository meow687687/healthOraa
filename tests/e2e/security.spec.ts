import { expect, test } from "@playwright/test";
import { accessToken, api, removeStorageObject } from "./support/api";
import { PERSONAS, PUBLISHABLE_KEY, SUPABASE_URL } from "./support/config";
import { lit, psql, script } from "./support/db";

const responseRows = <T>(body: unknown): T[] => {
  if (!Array.isArray(body)) throw new Error(`Expected a row array, received ${JSON.stringify(body)}`);
  return body as T[];
};

test.describe("Phase 1 security boundaries", () => {
  test("an incomplete account deletion can be retried with a refreshed session", async () => {
    const email = `phase1-delete-${Date.now()}@healthoraa.test`;
    const password = `Healthoraa-${Date.now()}-Test!`;
    const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ email, password, data: { full_name: "Synthetic deletion test" } }),
    });
    expect(signup.status).toBe(200);
    const signedUp = await signup.json() as {
      access_token?: string;
      refresh_token?: string;
      user?: { id?: string };
    };
    const userId = signedUp.user?.id;
    const refreshToken = signedUp.refresh_token;
    const accessToken = signedUp.access_token;
    if (!userId || !refreshToken || !accessToken) throw new Error("The synthetic patient account did not receive a session.");
    const legacyRecordPath = `${userId}/health-locker/legacy-${Date.now()}.pdf`;
    const bulkFixturePrefix = `phase1-bulk-${Date.now()}`;

    try {
      const legacyUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${legacyRecordPath}`, {
        method: "POST",
        headers: {
          apikey: PUBLISHABLE_KEY,
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/pdf",
        },
        body: "%PDF-1.4\nSynthetic legacy Health Locker fixture.\n%%EOF",
      });
      expect([200, 201]).toContain(legacyUpload.status);
      expect(psql(`select owner_id from storage.objects where bucket_id = 'medical-records' and name = ${lit(legacyRecordPath)}`)).toBe(userId);
      script(`
        insert into storage.objects (bucket_id, name, owner_id, metadata)
        select 'medical-records', '${userId}/locker/${bulkFixturePrefix}-record-' || object_number || '.pdf', '${userId}',
               '{"mimetype":"application/pdf","size":64}'
        from generate_series(1, 1001) AS object_number;
        insert into storage.objects (bucket_id, name, owner_id, metadata)
        select 'diet-charts', '${userId}/meals/${bulkFixturePrefix}-meal-' || object_number || '.jpg', '${userId}',
               '{"mimetype":"image/jpeg","size":64}'
        from generate_series(1, 1001) AS object_number;
      `);

      // Model the state after personal data is scrubbed but before auth deletion succeeds.
      script(`
        update profiles set deleted_at = now(), full_name = 'Deleted patient', phone = null, avatar_url = null
        where id = '${userId}';
        update auth.users set email = ${lit(`deleted-${userId}@deleted.invalid`)} where id = '${userId}';
      `);
      const tokenAfterDeletionStarted = await api(accessToken, "POST", "/rpc/register_patient_push_token", {
        p_expo_push_token: `ExponentPushToken[phase1-deleted-${Date.now()}]`,
      });
      expect(tokenAfterDeletionStarted.status).toBeGreaterThanOrEqual(400);

      const refreshed = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      expect(refreshed.status).toBe(200);
      const refreshedSession = await refreshed.json() as { access_token?: string };
      expect(refreshedSession.access_token).toBeTruthy();

      const deletion = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          apikey: PUBLISHABLE_KEY,
          authorization: `Bearer ${refreshedSession.access_token}`,
          "content-type": "application/json",
        },
        body: "{}",
      });
      expect(deletion.status, await deletion.clone().text()).toBe(200);
      expect((await deletion.json() as { deleted?: boolean }).deleted).toBe(true);
      expect(psql(`select full_name || '|' || (deleted_at is not null)::text from profiles where id = '${userId}'`)).toBe("Deleted patient|true");
      expect(psql(`select count(*) from storage.objects where bucket_id = 'medical-records' and name = ${lit(legacyRecordPath)}`)).toBe("0");
      expect(psql(`select count(*) from storage.objects where bucket_id = 'medical-records' and name like ${lit(`${userId}/locker/${bulkFixturePrefix}-%`)}`)).toBe("0");
      expect(psql(`select count(*) from storage.objects where bucket_id = 'diet-charts' and name like ${lit(`${userId}/meals/${bulkFixturePrefix}-%`)}`)).toBe("0");
    } finally {
      script(`delete from auth.users where id = '${userId}';`);
      if (psql(`select count(*) from storage.objects where bucket_id = 'medical-records' and name = ${lit(legacyRecordPath)}`) !== "0") {
        await removeStorageObject("medical-records", legacyRecordPath);
      }
    }
  });

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

    const transferredToken = `ExponentPushToken[phase1-transfer-${Date.now()}]`;
    script(`
      insert into patient_push_tokens (user_id, expo_push_token)
      values ('${PERSONAS.doctor.id}', ${lit(transferredToken)});
    `);
    try {
      const transfer = await api(patientToken, "POST", "/rpc/register_patient_push_token", {
        p_expo_push_token: transferredToken,
      });
      expect([200, 204]).toContain(transfer.status);
      expect(psql(`select user_id from patient_push_tokens where expo_push_token = ${lit(transferredToken)}`)).toBe(PERSONAS.patient.id);
    } finally {
      script(`delete from patient_push_tokens where expo_push_token = ${lit(transferredToken)};`);
    }

    const registeredToken = `ExponentPushToken[phase1-rpc-only-${Date.now()}]`;
    const registration = await api(patientToken, "POST", "/rpc/register_patient_push_token", {
      p_expo_push_token: registeredToken,
    });
    expect([200, 204]).toContain(registration.status);
    try {
      const directInsert = await api(patientToken, "POST", "/patient_push_tokens", {
        user_id: PERSONAS.patient.id,
        expo_push_token: `ExponentPushToken[phase1-direct-insert-${Date.now()}]`,
      });
      expect(directInsert.status).toBeGreaterThanOrEqual(400);

      const directUpdate = await api(patientToken, "PATCH", `/patient_push_tokens?user_id=eq.${PERSONAS.patient.id}`, {
        expo_push_token: `ExponentPushToken[phase1-direct-update-${Date.now()}]`,
      });
      expect(directUpdate.status).toBeGreaterThanOrEqual(400);
    } finally {
      const removeRegisteredToken = await api(patientToken, "DELETE", `/patient_push_tokens?user_id=eq.${PERSONAS.patient.id}`);
      expect(removeRegisteredToken.status).toBe(200);
    }
  });

  test("private medical and diet files are scoped to the patient and use short-lived links", async () => {
    const [patientToken, doctorToken, adminToken] = await Promise.all([
      accessToken("patient"),
      accessToken("doctor"),
      accessToken("admin"),
    ]);
    const recordPath = `${PERSONAS.patient.id}/locker/phase1-security-check-${Date.now()}.pdf`;
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
    expect(psql(`select owner_id from storage.objects where bucket_id = 'medical-records' and name = ${lit(recordPath)}`)).toBe(PERSONAS.patient.id);

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
    expect(psql(`select count(*) from public.list_patient_owned_meal_objects('${PERSONAS.patient.id}') where bucket_id = 'diet-charts' and name = ${lit(dietPath)}`)).toBe("1");

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

    expect(psql("select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'program_enrolments'")).toBe("1");

    const documentInsert = await api(patientToken, "POST", "/patient_documents", {
      patient_id: PERSONAS.patient.id,
      title: "Synthetic security fixture",
      file_path: recordPath,
      mime_type: "application/pdf",
    });
    expect(documentInsert.status, JSON.stringify(documentInsert.body)).toBe(201);

    const practitionerOwnedPath = `${PERSONAS.patient.id}/locker/practitioner-owned-${Date.now()}.pdf`;
    const practitionerUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${practitionerOwnedPath}`, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
        authorization: `Bearer ${doctorToken}`,
        "content-type": "application/pdf",
      },
      body: "%PDF-1.4\nSynthetic practitioner-owned fixture.\n%%EOF",
    });
    expect([200, 201]).toContain(practitionerUpload.status);
    expect(psql(`select owner_id from storage.objects where bucket_id = 'medical-records' and name = ${lit(practitionerOwnedPath)}`)).toBe(PERSONAS.doctor.id);
    try {
      const cannotRegisterPractitionerFile = await api(patientToken, "POST", "/patient_documents", {
        patient_id: PERSONAS.patient.id,
        title: "Synthetic ownership mismatch",
        file_path: practitionerOwnedPath,
        mime_type: "application/pdf",
      });
      expect(cannotRegisterPractitionerFile.status).not.toBe(201);
      expect(psql(`select count(*) from public.list_patient_owned_record_objects('${PERSONAS.patient.id}') where bucket_id = 'medical-records' and name = ${lit(practitionerOwnedPath)}`)).toBe("0");
    } finally {
      await removeStorageObject("medical-records", practitionerOwnedPath);
    }

    expect(psql(`select count(*) from public.list_patient_owned_record_objects('${PERSONAS.patient.id}') where bucket_id = 'medical-records' and name = ${lit(recordPath)}`)).toBe("1");
    const diagnosticTitle = `phase1-retained-report-${Date.now()}`;
    const diagnosticReport = await api(patientToken, "POST", "/diagnostic_reports", {
      patient_id: PERSONAS.patient.id,
      report_title: diagnosticTitle,
      file_url: `https://local.invalid/storage/v1/object/sign/medical-records/${recordPath}?token=synthetic`,
      file_type: "application/pdf",
    });
    expect(diagnosticReport.status).toBe(201);
    const diagnosticId = responseRows<{ id: string }>(diagnosticReport.body)[0]?.id;
    expect(diagnosticId).toBeTruthy();
    expect(psql(`select count(*) from public.list_patient_owned_record_objects('${PERSONAS.patient.id}') where bucket_id = 'medical-records' and name = ${lit(recordPath)}`)).toBe("0");
    try {
      const cannotDeleteReferencedRecord = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${recordPath}`, {
        method: "DELETE",
        headers,
      });
      expect(cannotDeleteReferencedRecord.status).not.toBe(200);
      expect(cannotDeleteReferencedRecord.status).not.toBe(204);
      expect(psql(`select count(*) from storage.objects where bucket_id = 'medical-records' and name = ${lit(recordPath)}`)).toBe("1");

      script(`delete from patient_documents where file_path = ${lit(recordPath)};`);
      const cannotDeleteRetainedDiagnostic = await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${recordPath}`, {
        method: "DELETE",
        headers,
      });
      expect(cannotDeleteRetainedDiagnostic.status).not.toBe(200);
      expect(cannotDeleteRetainedDiagnostic.status).not.toBe(204);
      expect(psql(`select count(*) from diagnostic_reports where id = '${diagnosticId}'`)).toBe("1");
      expect(psql(`select count(*) from public.list_patient_owned_record_objects('${PERSONAS.patient.id}') where bucket_id = 'medical-records' and name = ${lit(recordPath)}`)).toBe("0");
    } finally {
      script(`delete from patient_documents where file_path = ${lit(recordPath)};`);
      script(`delete from diagnostic_reports where report_title = ${lit(diagnosticTitle)};`);
      await fetch(`${SUPABASE_URL}/storage/v1/object/medical-records/${recordPath}`, {
        method: "DELETE",
        headers,
      });
    }
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
