import { expect, test } from "@playwright/test";
import { PERSONAS } from "./support/config";
import { lit, psql, script } from "./support/db";
import { accessToken, api } from "./support/api";
import { sendPaymentCaptured } from "./support/webhook";

// Regression checks for the review fixes. Each one fails if its bug comes back. They call the
// database and the webhook directly, so they do not depend on the portals' screens.

const run = `regress-${Date.now()}`;
const PATIENT = PERSONAS.patient.id;
const DOCTOR = PERSONAS.doctor.id;
const FAR_FUTURE = "2031-04-01";

const insertConsultation = (id: string, status: string, bookingStatus: string, orderId: string | null): void => {
  script(`
    insert into consultations (id, patient_id, doctor_id, slot_start, slot_end, status, booking_status,
                               chief_complaint, amount_inr, payment_order_id)
    values ('${id}', '${PATIENT}', '${DOCTOR}', now() + interval '2 days', now() + interval '2 days 30 minutes',
            '${status}', '${bookingStatus}', ${lit(`${run} consultation`)}, 799,
            ${orderId ? lit(orderId) : "null"});
  `);
};

const cleanup = (): void => {
  script(`
    delete from payment_transactions where gateway_payment_id like ${lit(`pay_${run}%`)};
    delete from razorpay_order_logs where order_id like ${lit(`order_${run}%`)};
    delete from consultation_slots where start_time = '${FAR_FUTURE} 04:30:00+00';
    delete from consultations where chief_complaint like ${lit(`${run}%`)};
    delete from program_enrolments where program_id in (select id from programs where title like ${lit(`${run}%`)});
    delete from programs where title like ${lit(`${run}%`)};
  `);
};

test.describe.serial("review fixes", () => {
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test("booking charges the practitioner's fee plus GST, and ignores any fee the client sends", async () => {
    script(`
      insert into consultation_slots (practitioner_id, start_time, end_time)
      values ('${DOCTOR}', '${FAR_FUTURE} 04:30:00+00', '${FAR_FUTURE} 05:00:00+00');
    `);
    const slotId = psql(`select id from consultation_slots where start_time = '${FAR_FUTURE} 04:30:00+00'`);
    const patientToken = await accessToken("patient");

    // The old signature took a fee. It no longer exists, so a call that sends one is refused.
    const withFee = await api(patientToken, "POST", "/rpc/initiate_consultation_booking", {
      p_slot_id: slotId,
      p_patient_id: PATIENT,
      p_chief_complaint: `${run} fee`,
      p_fee: 1,
    });
    expect(withFee.status).toBe(404);

    const booked = await api(patientToken, "POST", "/rpc/initiate_consultation_booking", {
      p_slot_id: slotId,
      p_patient_id: PATIENT,
      p_chief_complaint: `${run} fee`,
    });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);
    // ₹799.00 plus 18% GST is ₹942.82, which is 94282 paise.
    const [breakdown] = booked.body as Array<{ fee_paise: number; gst_paise: number; total_paise: number }>;
    expect(breakdown.fee_paise).toBe(79900);
    expect(breakdown.gst_paise).toBe(14382);
    expect(breakdown.total_paise).toBe(94282);
    expect(psql(`select amount_inr from consultations where chief_complaint = ${lit(`${run} fee`)}`)).toBe("942.82");
    script(`delete from razorpay_order_logs where entity_id in (select id from consultations where chief_complaint = ${lit(`${run} fee`)});`);
    script(`delete from consultations where chief_complaint = ${lit(`${run} fee`)};`);
    script(`update consultation_slots set is_booked = false, consultation_id = null where id = '${slotId}';`);
  });

  test("a late payment never confirms a cancelled booking", async () => {
    const id = crypto.randomUUID();
    const orderId = `order_${run}_late`;
    insertConsultation(id, "scheduled", "cancelled", orderId);
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'created', 'consultation', '${id}');
    `);

    const result = await sendPaymentCaptured({
      orderId,
      amountPaise: 79900,
      currency: "INR",
      paymentId: `pay_${run}_late`,
    });
    expect(result.status).toBe(200);
    expect(result.body.booking_status).toBe("cancelled");
    expect(result.body.refund_review).toBe(true);
    expect(psql(`select booking_status from consultations where id = '${id}'`)).toBe("cancelled");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(`pay_${run}_late`)}`)).toBe(
      "captured",
    );
  });

  test("concurrent deliveries of one program payment create one active enrolment", async () => {
    script(
      `insert into programs (title, category, duration_days, price_inr, is_active)
       values (${lit(`${run} program`)}, 'custom', 30, 1999, true);`,
    );
    const programId = psql(`select id from programs where title = ${lit(`${run} program`)}`);
    const orderId = `order_${run}_program`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 199900, 'INR', 'created', 'program', '${programId}');
    `);

    const deliveries = await Promise.all(
      [1, 2, 3, 4].map(() =>
        sendPaymentCaptured({ orderId, amountPaise: 199900, currency: "INR", paymentId: `pay_${run}_program` }),
      ),
    );
    for (const delivery of deliveries) expect(delivery.status).toBe(200);
    expect(
      Number(
        psql(
          `select count(*) from program_enrolments where patient_id = '${PATIENT}' and program_id = '${programId}' and status = 'active'`,
        ),
      ),
    ).toBe(1);
  });

  test("an expired enrolment still marked active fails the webhook instead of reporting success", async () => {
    script(
      `insert into programs (title, category, duration_days, price_inr, is_active)
       values (${lit(`${run} stale program`)}, 'custom', 30, 1999, true);`,
    );
    const programId = psql(`select id from programs where title = ${lit(`${run} stale program`)}`);
    // The row is active but its window has ended. It blocks the unique index, yet is not a live enrolment.
    script(`
      insert into program_enrolments (patient_id, program_id, started_at, expires_at, status)
      values ('${PATIENT}', '${programId}', now() - interval '60 days', now() - interval '1 day', 'active');
    `);
    const orderId = `order_${run}_stale`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 199900, 'INR', 'created', 'program', '${programId}');
    `);

    const result = await sendPaymentCaptured({
      orderId,
      amountPaise: 199900,
      currency: "INR",
      paymentId: `pay_${run}_stale`,
    });
    expect(result.status).toBe(500);
    expect(String(result.body.error)).toContain("expired active enrolment");
    expect(
      Number(psql(`select count(*) from program_enrolments where program_id = '${programId}' and status = 'active'`)),
    ).toBe(1);
  });

  test("a cancelled consultation cannot receive a prescription", async () => {
    const id = crypto.randomUUID();
    insertConsultation(id, "cancelled", "cancelled", null);
    const doctorToken = await accessToken("doctor");

    const attempt = await api(doctorToken, "POST", "/prescriptions", {
      id: crypto.randomUUID(),
      consultation_id: id,
      doctor_id: DOCTOR,
      patient_id: PATIENT,
      diagnosis: `${run} should not be written`,
      followup_days: 7,
    });
    expect([401, 403]).toContain(attempt.status);
    expect(psql(`select count(*) from prescriptions where consultation_id = '${id}'`)).toBe("0");
    expect(psql(`select status from consultations where id = '${id}'`)).toBe("cancelled");
  });

  test("a prescription medicine must have a name, a dosage and a duration of 1 to 180 days", async () => {
    const id = crypto.randomUUID();
    insertConsultation(id, "scheduled", "confirmed", null);
    const doctorToken = await accessToken("doctor");

    for (const medicine of [
      { name: "", dosage: "1 tablet", frequency: "Once daily at night", duration_days: 10, instructions: "" },
      { name: "Metformin 500mg", dosage: "   ", frequency: "Once daily at night", duration_days: 10, instructions: "" },
      { name: "Metformin 500mg", dosage: "1 tablet", frequency: "Once daily at night", duration_days: 0, instructions: "" },
    ]) {
      const attempt = await api(doctorToken, "POST", "/rpc/issue_prescription", {
        p_consultation_id: id,
        p_diagnosis: `${run} blank medicine`,
        p_clinical_notes: "",
        p_followup_days: 7,
        p_medicines: [medicine],
      });
      expect(attempt.status).toBe(400);
    }
    expect(psql(`select count(*) from prescriptions where consultation_id = '${id}'`)).toBe("0");
  });

  test("a failed schedule publish leaves the previous rules and slot length in place", async () => {
    const doctorToken = await accessToken("doctor");
    const before = psql(
      `select (select count(*) from practitioner_availability_rules where practitioner_id = '${DOCTOR}') || '|' ||
              (select slot_duration_minutes from practitioner_details where id = '${DOCTOR}')`,
    );

    const attempt = await api(doctorToken, "POST", "/rpc/publish_schedule", {
      p_duration_minutes: 45,
      p_rules: [{ day_of_week: 1, start_time: "10:00", end_time: "09:00", is_active: true }],
      p_days: 7,
    });
    expect(attempt.status).toBe(400);

    const after = psql(
      `select (select count(*) from practitioner_availability_rules where practitioner_id = '${DOCTOR}') || '|' ||
              (select slot_duration_minutes from practitioner_details where id = '${DOCTOR}')`,
    );
    expect(after).toBe(before);
  });

  test("the lookup indexes exist", async () => {
    const names = [
      "consultations_patient_id_idx",
      "consultations_doctor_slot_idx",
      "consultation_messages_thread_idx",
      "prescriptions_consultation_id_idx",
      "prescriptions_patient_id_idx",
      "prescription_medicines_prescription_id_idx",
      "orders_customer_id_idx",
      "program_enrolments_one_active_per_program",
    ];
    const found = psql(
      `select count(*) from pg_indexes where schemaname = 'public' and indexname in (${names.map(lit).join(",")})`,
    );
    expect(Number(found)).toBe(names.length);
  });
});
