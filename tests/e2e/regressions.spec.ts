import { expect, test } from "@playwright/test";
import { updateOrderStatusSchema } from "../../packages/validation/src/orders";
import { PERSONAS, PUBLISHABLE_KEY, SUPABASE_URL } from "./support/config";
import { lit, psql, script } from "./support/db";
import { accessToken, api } from "./support/api";
import { sendPaymentCaptured, sendPaymentFailed, sendRefundProcessed } from "./support/webhook";

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
    delete from payment_refund_reviews where gateway_payment_id like ${lit(`pay_${run}%`)};
    delete from razorpay_refund_events where gateway_payment_id like ${lit(`pay_${run}%`)};
    delete from payment_transactions where gateway_payment_id like ${lit(`pay_${run}%`)};
    delete from razorpay_order_logs where order_id like ${lit(`order_${run}%`)};
    delete from orders where shipping_address like ${lit(`${run}%`)};
    delete from consultation_slots where id in (
      select slot_id from consultations where chief_complaint like ${lit(`${run}%`)} and slot_id is not null
    ) or start_time = '${FAR_FUTURE} 04:30:00+00';
    delete from consultations where chief_complaint like ${lit(`${run}%`)};
    delete from program_enrolments where program_id in (select id from programs where title like ${lit(`${run}%`)});
    delete from programs where title like ${lit(`${run}%`)};
    delete from products where sku = ${lit(`${run}-cancel-stock`)};
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
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe("captured");
    expect(result.body.refund_review).toBe(true);
    expect(psql(`select booking_status from consultations where id = '${id}'`)).toBe("cancelled");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(`pay_${run}_late`)}`)).toBe(
      "captured",
    );
  });

  test("failed payment diagnostics persist and a delayed failure cannot downgrade capture", async () => {
    const id = crypto.randomUUID();
    const orderId = `order_${run}_failed_then_captured`;
    const failedPaymentId = `pay_${run}_failed_attempt`;
    const capturedPaymentId = `pay_${run}_successful_attempt`;
    insertConsultation(id, "scheduled", "pending_payment", orderId);
    script(`
      update consultations set payment_expires_at = now() + interval '10 minutes' where id = '${id}';
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'created', 'consultation', '${id}');
    `);

    const failed = await sendPaymentFailed({ orderId, amountPaise: 79900, currency: "INR", paymentId: failedPaymentId });
    expect(failed.status, JSON.stringify(failed.body)).toBe(200);
    expect(failed.body.status).toBe("failed");
    expect(psql(`select booking_status from consultations where id = '${id}'`)).toBe("pending_payment");
    expect(psql(`select error_code || '|' || error_description from payment_transactions where gateway_payment_id = ${lit(failedPaymentId)}`)).toBe("BAD_REQUEST_ERROR|Payment failed");

    const captured = await sendPaymentCaptured({ orderId, amountPaise: 79900, currency: "INR", paymentId: capturedPaymentId });
    expect(captured.status, JSON.stringify(captured.body)).toBe(200);
    expect(psql(`select booking_status from consultations where id = '${id}'`)).toBe("confirmed");

    const delayedFailure = await sendPaymentFailed({ orderId, amountPaise: 79900, currency: "INR", paymentId: capturedPaymentId });
    expect(delayedFailure.status, JSON.stringify(delayedFailure.body)).toBe(200);
    expect(delayedFailure.body.status).toBe("captured");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(capturedPaymentId)}`)).toBe("captured");
  });

  test("patients can cancel pending bookings exactly once and release the held slot", async () => {
    const patientToken = await accessToken("patient");
    const doctorToken = await accessToken("doctor");
    const consultationId = crypto.randomUUID();
    const slotId = crypto.randomUUID();
    const slotStart = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 60_000)).toISOString();
    const slotEnd = new Date(Date.parse(slotStart) + 30 * 60 * 1000).toISOString();
    const orderId = `order_${run}_cancel_booking`;
    script(`
      insert into consultation_slots (id, practitioner_id, start_time, end_time)
      values ('${slotId}', '${DOCTOR}', '${slotStart}', '${slotEnd}');
      insert into consultations (id, patient_id, doctor_id, slot_start, slot_end, status, booking_status,
                                 chief_complaint, amount_inr, payment_order_id, slot_id, payment_expires_at)
      values ('${consultationId}', '${PATIENT}', '${DOCTOR}', '${slotStart}',
              '${slotEnd}', 'scheduled', 'pending_payment', ${lit(`${run} cancellable booking`)},
              799, ${lit(orderId)}, '${slotId}', now() + interval '10 minutes');
      update consultation_slots set is_booked = true, consultation_id = '${consultationId}' where id = '${slotId}';
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'created', 'consultation', '${consultationId}');
    `);

    const denied = await api(doctorToken, "POST", "/rpc/cancel_pending_consultation_booking", { p_consultation_id: consultationId });
    expect(denied.status, JSON.stringify(denied.body)).toBe(200);
    expect(denied.body).toBe(false);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const cancelled = await api(patientToken, "POST", "/rpc/cancel_pending_consultation_booking", { p_consultation_id: consultationId });
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
      expect(cancelled.body).toBe(true);
    }
    expect(psql(`select booking_status::text || '|' || status::text from consultations where id = '${consultationId}'`)).toBe("cancelled|cancelled");
    expect(psql(`select is_booked::text || '|' || (consultation_id is null)::text from consultation_slots where id = '${slotId}'`)).toBe("false|true");

    const lateCapture = await sendPaymentCaptured({ orderId, amountPaise: 79900, currency: "INR", paymentId: `pay_${run}_cancel_booking_late` });
    expect(lateCapture.status, JSON.stringify(lateCapture.body)).toBe(200);
    expect(lateCapture.body.refund_review).toBe(true);
    expect(psql(`select booking_status from consultations where id = '${consultationId}'`)).toBe("cancelled");
  });

  test("patients can cancel pending shop orders once, release stock, and prevent late capture fulfillment", async () => {
    const patientToken = await accessToken("patient");
    const orderId = crypto.randomUUID();
    const gatewayOrderId = `order_${run}_cancel_shop`;
    const sku = `${run}-cancel-stock`;
    const paymentId = `pay_${run}_cancel_shop_late`;
    script(`
      insert into products (sku, title, category, price_inr, stock_count, is_active)
      values (${lit(sku)}, ${lit(`${run} cancel test product`)}, 'supplements', 100, 10, true);
      update products set stock_count = stock_count - 2 where sku = ${lit(sku)};
      insert into orders (id, customer_id, total_amount_inr, status, shipping_address, reservation_expires_at)
      values ('${orderId}', '${PATIENT}', 236, 'pending', ${lit(`${run} cancel test address`)}, now() + interval '10 minutes');
      insert into order_items (order_id, product_id, quantity, unit_price_inr)
      select '${orderId}', id, 2, 100 from products where sku = ${lit(sku)};
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(gatewayOrderId)}, '${PATIENT}', 23600, 'INR', 'created', 'shop_order', '${orderId}');
    `);
    const stock = (): string => psql(`select stock_count from products where sku = ${lit(sku)}`);
    expect(stock()).toBe("8");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const cancelled = await api(patientToken, "POST", "/rpc/cancel_pending_shop_order", { p_order_id: orderId });
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
      expect(cancelled.body).toBe(true);
    }
    expect(stock()).toBe("10");
    expect(psql(`select status::text || '|' || (stock_released_at is not null)::text from orders where id = '${orderId}'`)).toBe("cancelled|true");

    const lateCapture = await sendPaymentCaptured({ orderId: gatewayOrderId, amountPaise: 23600, currency: "INR", paymentId });
    expect(lateCapture.status, JSON.stringify(lateCapture.body)).toBe(200);
    expect(lateCapture.body.refund_review).toBe(true);
    expect(psql(`select status from orders where id = '${orderId}'`)).toBe("cancelled");
    expect(stock()).toBe("10");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("pending");
  });

  test("a capture after consultation expiry is queued for refund before the expiry sweep", async () => {
    const id = crypto.randomUUID();
    const orderId = `order_${run}_expired`;
    insertConsultation(id, "scheduled", "pending_payment", orderId);
    script(`
      update consultations set payment_expires_at = now() - interval '1 second' where id = '${id}';
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'created', 'consultation', '${id}');
    `);

    const result = await sendPaymentCaptured({
      orderId,
      amountPaise: 79900,
      currency: "INR",
      paymentId: `pay_${run}_expired`,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.refund_review).toBe(true);
    expect(psql(`select booking_status from consultations where id = '${id}'`)).toBe("pending_payment");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refund_review");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(`pay_${run}_expired`)}`)).toBe(
      "captured",
    );
    expect(
      psql(`select reason from payment_refund_reviews where gateway_payment_id = ${lit(`pay_${run}_expired`)}`),
    ).toContain("reservation expired");
  });

  test("a partial refund without a prior review is added to the admin refund queue", async () => {
    const orderId = `order_${run}_partial`;
    const paymentId = `pay_${run}_partial`;
    const entityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'fulfilled', 'shop_order', '${entityId}');
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(paymentId)}, ${lit(orderId)}, 799, 'INR', 'captured');
    `);

    const result = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_partial`,
      refundAmountPaise: 12000,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe("partial_refund_review");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refund_review");
    expect(psql(`select refund_id from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(`rfnd_${run}_partial`);
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("pending");
    expect(psql(`select user_id from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(PATIENT);
    expect(psql(`select public.has_pending_payment_refund_review('${PATIENT}', 'shop_order', '${entityId}')::text`)).toBe("true");
  });

  test("a failed refund-review insert rolls back the order hold", async () => {
    const orderId = `order_${run}_atomic_review`;
    const paymentId = `pay_${run}_atomic_review`;
    const triggerSuffix = `regress_${Date.now()}`;
    const functionName = `test_reject_refund_review_${triggerSuffix}`;
    const triggerName = `test_reject_refund_review_${triggerSuffix}`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'superseded', 'program', '${crypto.randomUUID()}');
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(paymentId)}, ${lit(orderId)}, 799, 'INR', 'captured');
      create function public.${functionName}() returns trigger language plpgsql as $$
      begin
        if new.gateway_payment_id = ${lit(paymentId)} then raise exception 'forced refund-review insert failure'; end if;
        return new;
      end;
      $$;
      create trigger ${triggerName} before insert on payment_refund_reviews
      for each row execute function public.${functionName}();
    `);

    try {
      script(`
        do $$ begin
          perform public.record_captured_payment_refund_review(
            ${lit(paymentId)}, ${lit(orderId)}, '${PATIENT}', 'Atomicity regression', false, false
          );
        exception when others then null;
        end $$;
      `);
      expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("superseded");
      expect(psql(`select count(*) from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("0");
    } finally {
      script(`drop trigger if exists ${triggerName} on payment_refund_reviews; drop function if exists public.${functionName}();`);
    }
  });

  test("a processed refund releases only an unowned late-capture hold", async () => {
    const orderId = `order_${run}_orphan_hold`;
    const paymentId = `pay_${run}_orphan_hold`;
    const entityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'superseded', 'program', '${entityId}');
    `);

    const captured = await sendPaymentCaptured({ orderId, amountPaise: 79900, currency: "INR", paymentId });
    expect(captured.status, JSON.stringify(captured.body)).toBe(200);
    expect(captured.body.refund_review).toBe(true);
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refund_review");

    const refunded = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_orphan_hold`,
      refundAmountPaise: 79900,
    });
    expect(refunded.status, JSON.stringify(refunded.body)).toBe(200);
    expect(refunded.body.status).toBe("refunded");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refunded");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("resolved");
    expect(psql(`select public.has_pending_payment_refund_review('${PATIENT}', 'program', '${entityId}')::text`)).toBe("false");

    const ownedOrderId = `order_${run}_owned_hold`;
    const previousPaymentId = `pay_${run}_owned_original`;
    const latePaymentId = `pay_${run}_owned_late`;
    const ownedEntityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(ownedOrderId)}, '${PATIENT}', 79900, 'INR', 'refund_review', 'program', '${ownedEntityId}', ${lit(previousPaymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(previousPaymentId)}, ${lit(ownedOrderId)}, 799, 'INR', 'refund_review');
      insert into payment_refund_reviews (gateway_payment_id, gateway_order_id, user_id, reason)
      values (${lit(previousPaymentId)}, ${lit(ownedOrderId)}, '${PATIENT}', 'Existing captured payment remains under review');
    `);

    const lateCapture = await sendPaymentCaptured({
      orderId: ownedOrderId,
      amountPaise: 79900,
      currency: "INR",
      paymentId: latePaymentId,
    });
    expect(lateCapture.status, JSON.stringify(lateCapture.body)).toBe(200);
    const lateRefund = await sendRefundProcessed({
      orderId: ownedOrderId,
      paymentId: latePaymentId,
      refundId: `rfnd_${run}_owned_late`,
      refundAmountPaise: 79900,
    });
    expect(lateRefund.status, JSON.stringify(lateRefund.body)).toBe(200);
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(ownedOrderId)}`)).toBe("refund_review");
    expect(psql(`select captured_payment_id from razorpay_order_logs where order_id = ${lit(ownedOrderId)}`)).toBe(previousPaymentId);
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(previousPaymentId)}`)).toBe("pending");
  });

  test("capture confirmation refuses payment rows already marked refunded", async () => {
    const consultationId = crypto.randomUUID();
    const consultationOrderId = `order_${run}_refunded_consultation`;
    const consultationPaymentId = `pay_${run}_refunded_consultation`;
    insertConsultation(consultationId, "scheduled", "pending_payment", consultationOrderId);
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(consultationOrderId)}, '${PATIENT}', 79900, 'INR', 'captured', 'consultation', '${consultationId}', ${lit(consultationPaymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, consultation_id, amount_inr, currency, status)
      values (${lit(consultationPaymentId)}, ${lit(consultationOrderId)}, '${consultationId}', 799, 'INR', 'refunded');
    `);
    expect(psql(`select public.confirm_consultation_payment_capture('${consultationId}', '${PATIENT}', ${lit(consultationOrderId)})::text`)).toBe("false");
    expect(psql(`select booking_status from consultations where id = '${consultationId}'`)).toBe("pending_payment");

    const shopOrderId = crypto.randomUUID();
    const shopGatewayOrderId = `order_${run}_refunded_shop`;
    const shopPaymentId = `pay_${run}_refunded_shop`;
    script(`
      insert into orders (id, customer_id, total_amount_inr, status, shipping_address)
      values ('${shopOrderId}', '${PATIENT}', 799, 'pending', ${lit(`${run} test address`)});
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(shopGatewayOrderId)}, '${PATIENT}', 79900, 'INR', 'captured', 'shop_order', '${shopOrderId}', ${lit(shopPaymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, order_id, amount_inr, currency, status)
      values (${lit(shopPaymentId)}, ${lit(shopGatewayOrderId)}, '${shopOrderId}', 799, 'INR', 'refunded');
    `);
    expect(psql(`select public.confirm_shop_order_payment_capture('${shopOrderId}', '${PATIENT}', ${lit(shopGatewayOrderId)})::text`)).toBe("false");
    expect(psql(`select status from orders where id = '${shopOrderId}'`)).toBe("pending");
  });

  test("refunds delivered before capture are retained and applied when the payment arrives", async () => {
    script(
      `insert into programs (title, category, duration_days, price_inr, is_active)
       values (${lit(`${run} early refund program`)}, 'custom', 30, 1999, true);`,
    );
    const programId = psql(`select id from programs where title = ${lit(`${run} early refund program`)}`);
    const orderId = `order_${run}_early_refund`;
    const paymentId = `pay_${run}_early_refund`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 199900, 'INR', 'created', 'program', '${programId}');
    `);

    const refund = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_early_refund`,
      refundAmountPaise: 199900,
    });
    expect(refund.status, JSON.stringify(refund.body)).toBe(200);
    expect(refund.body.status).toBe("unmatched");
    expect(psql(`select status from razorpay_refund_events where gateway_payment_id = ${lit(paymentId)}`)).toBe("processed");

    const capture = await sendPaymentCaptured({ orderId, amountPaise: 199900, currency: "INR", paymentId });
    expect(capture.status, JSON.stringify(capture.body)).toBe(200);
    expect(capture.body.status).toBe("refunded");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refunded");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refunded");
    expect(psql(`select count(*) from program_enrolments where program_id = '${programId}' and status = 'active'`)).toBe("0");
  });

  test("separate partial refunds reconcile to a full refund", async () => {
    const orderId = `order_${run}_multi_refund`;
    const paymentId = `pay_${run}_multi_refund`;
    const entityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'fulfilled', 'shop_order', '${entityId}');
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(paymentId)}, ${lit(orderId)}, 799, 'INR', 'captured');
    `);

    const first = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_multi_a`,
      refundAmountPaise: 30000,
    });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.status).toBe("partial_refund_review");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refund_review");

    const second = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_multi_b`,
      refundAmountPaise: 49900,
    });
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(second.body.status).toBe("refunded");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refunded");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("resolved");
    expect(psql(`select sum(amount_paise) from razorpay_refund_events where gateway_payment_id = ${lit(paymentId)} and status = 'processed'`)).toBe("79900");
  });

  test("an admin refund reference does not resolve a review before provider evidence", async () => {
    const orderId = `order_${run}_manual_review`;
    const paymentId = `pay_${run}_manual_review`;
    const refundId = `rfnd_${run}_manual_review`;
    const entityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'captured', 'program', '${entityId}', ${lit(paymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(paymentId)}, ${lit(orderId)}, 799, 'INR', 'captured');
    `);

    const partial = await sendRefundProcessed({ orderId, paymentId, refundId, refundAmountPaise: 12000 });
    expect(partial.status, JSON.stringify(partial.body)).toBe(200);
    expect(partial.body.status).toBe("partial_refund_review");

    const adminToken = await accessToken("admin");
    const recorded = await api(adminToken, "POST", "/rpc/record_payment_refund_review", {
      p_gateway_payment_id: paymentId,
      p_refund_id: `manual_${refundId}`,
    });
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(200);
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("pending");
    expect(psql(`select manual_refund_reference from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(`manual_${refundId}`);
    expect(psql(`select manual_refund_recorded_by from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(PERSONAS.admin.id);
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refund_review");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refund_review");
    expect(psql(`select public.has_pending_payment_refund_review('${PATIENT}', 'program', '${entityId}')::text`)).toBe("true");

    const replay = await sendRefundProcessed({ orderId, paymentId, refundId, refundAmountPaise: 12000 });
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.status).toBe("partial_refund_review");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("pending");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refund_review");

    const completed = await sendRefundProcessed({
      orderId,
      paymentId,
      refundId: `rfnd_${run}_manual_review_completion`,
      refundAmountPaise: 67900,
    });
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(completed.body.status).toBe("refunded");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe("resolved");
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refunded");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refunded");
    expect(psql(`select refund_id from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(refundId);
    expect(psql(`select manual_refund_reference from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(`manual_${refundId}`);
    expect(psql(`select sum(amount_paise) from razorpay_refund_events where gateway_payment_id = ${lit(paymentId)} and status = 'processed'`)).toBe("79900");
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

  test("a second distinct captured payment on the same order is sent to refund review", async () => {
    script(
      `insert into programs (title, category, duration_days, price_inr, is_active)
       values (${lit(`${run} duplicate payment program`)}, 'custom', 30, 1999, true);`,
    );
    const programId = psql(`select id from programs where title = ${lit(`${run} duplicate payment program`)}`);
    const orderId = `order_${run}_duplicate_payment`;
    const firstPaymentId = `pay_${run}_duplicate_first`;
    const secondPaymentId = `pay_${run}_duplicate_second`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(orderId)}, '${PATIENT}', 199900, 'INR', 'created', 'program', '${programId}');
    `);

    const first = await sendPaymentCaptured({ orderId, amountPaise: 199900, currency: "INR", paymentId: firstPaymentId });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("fulfilled");

    const second = await sendPaymentCaptured({ orderId, amountPaise: 199900, currency: "INR", paymentId: secondPaymentId });
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.refund_review).toBe(true);
    expect(psql(`select captured_payment_id from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe(firstPaymentId);
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(secondPaymentId)}`)).toBe("pending");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("fulfilled");
    expect(psql(`select count(*) from program_enrolments where program_id = '${programId}' and status = 'active'`)).toBe("1");
  });

  test("a repeated capture does not start a second full refund during refund review", async () => {
    const orderId = `order_${run}_partial_review_replay`;
    const paymentId = `pay_${run}_partial_review_replay`;
    const entityId = crypto.randomUUID();
    const reason = `${run}: partial refund requires manual reconciliation`;
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'refund_review', 'program', '${entityId}', ${lit(paymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(paymentId)}, ${lit(orderId)}, 799, 'INR', 'refund_review');
      insert into payment_refund_reviews (gateway_payment_id, gateway_order_id, user_id, reason)
      values (${lit(paymentId)}, ${lit(orderId)}, '${PATIENT}', ${lit(reason)});
    `);

    const replay = await sendPaymentCaptured({ orderId, amountPaise: 79900, currency: "INR", paymentId });
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.refund_review).toBe(true);
    expect(replay.body.duplicate).toBe(true);
    expect(psql(`select reason from payment_refund_reviews where gateway_payment_id = ${lit(paymentId)}`)).toBe(reason);
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(paymentId)}`)).toBe("refund_review");
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refund_review");
  });

  test("a distinct late capture on a refunded order is recorded for refund review", async () => {
    const orderId = `order_${run}_refunded_late_capture`;
    const firstPaymentId = `pay_${run}_refunded_first`;
    const latePaymentId = `pay_${run}_refunded_late`;
    const entityId = crypto.randomUUID();
    script(`
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id, captured_payment_id)
      values (${lit(orderId)}, '${PATIENT}', 79900, 'INR', 'refunded', 'program', '${entityId}', ${lit(firstPaymentId)});
      insert into payment_transactions (gateway_payment_id, gateway_order_id, amount_inr, currency, status)
      values (${lit(firstPaymentId)}, ${lit(orderId)}, 799, 'INR', 'refunded');
    `);

    const lateCapture = await sendPaymentCaptured({ orderId, amountPaise: 79900, currency: "INR", paymentId: latePaymentId });
    expect(lateCapture.status, JSON.stringify(lateCapture.body)).toBe(200);
    expect(lateCapture.body.duplicate).toBe(true);
    expect(lateCapture.body.refund_review).toBe(true);
    expect(psql(`select status from payment_transactions where gateway_payment_id = ${lit(latePaymentId)}`)).toBe("captured");
    expect(psql(`select status from payment_refund_reviews where gateway_payment_id = ${lit(latePaymentId)}`)).toBe("pending");
    expect(psql(`select captured_payment_id from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe(firstPaymentId);
    expect(psql(`select status from razorpay_order_logs where order_id = ${lit(orderId)}`)).toBe("refunded");
  });

  test("a stale active enrolment is closed before a new paid enrolment is activated", async () => {
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
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe("captured");
    expect(
      Number(psql(`select count(*) from program_enrolments where program_id = '${programId}' and status = 'completed' and expires_at <= now()`)),
    ).toBe(1);
    expect(
      Number(psql(`select count(*) from program_enrolments where program_id = '${programId}' and status = 'active' and expires_at > now()`)),
    ).toBe(1);
    expect(
      psql(`select status || '|' || (program_enrolment_id is not null) from razorpay_order_logs where order_id = ${lit(orderId)}`),
    ).toBe("fulfilled|true");
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

  test("the practitioner listing returns only the public fields, never contact details", async () => {
    const patientToken = await accessToken("patient");
    const listing = await api(patientToken, "GET", "/rpc/get_verified_practitioners");
    expect(listing.status).toBe(200);
    const rows = listing.body as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "avatar_url",
      "bio",
      "consultation_fee_inr",
      "full_name",
      "id",
      "languages_spoken",
      "qualification",
      "slot_duration_minutes",
      "specialization",
      "years_of_experience",
    ]);
    // Without a signed-in session the listing is refused.
    const anonymous = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_verified_practitioners`, {
      headers: { apikey: PUBLISHABLE_KEY },
    });
    expect(anonymous.status).toBeGreaterThanOrEqual(400);
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

  test("tracking URLs require HTTPS and valid ports in app validation and the database", async () => {
    const orderId = crypto.randomUUID();
    script(`
      insert into orders (id, customer_id, total_amount_inr, status, shipping_address)
      values ('${orderId}', '${PATIENT}', 100, 'shipped', ${lit(`${run} tracking order`)});
    `);
    expect(() => psql(`update orders set tracking_url = 'http://carrier.example/track' where id = '${orderId}'`)).toThrow(
      /orders_tracking_url_https_check/,
    );
    expect(() => psql(`update orders set tracking_url = 'https://carrier.example:99999/track' where id = '${orderId}'`)).toThrow(
      /orders_tracking_url_https_check/,
    );
    const trackingUrl = "https://carrier.example/track?id=sample-123";
    script(`update orders set tracking_url = ${lit(trackingUrl)} where id = '${orderId}';`);
    expect(psql(`select tracking_url from orders where id = '${orderId}'`)).toBe(trackingUrl);
    const maxPortTrackingUrl = "https://carrier.example:65535/track";
    script(`update orders set tracking_url = ${lit(maxPortTrackingUrl)} where id = '${orderId}';`);
    expect(psql(`select tracking_url from orders where id = '${orderId}'`)).toBe(maxPortTrackingUrl);
    const ipv6TrackingUrl = "https://[2001:db8::1]:443/track";
    script(`update orders set tracking_url = ${lit(ipv6TrackingUrl)} where id = '${orderId}';`);
    expect(psql(`select tracking_url from orders where id = '${orderId}'`)).toBe(ipv6TrackingUrl);
    expect(updateOrderStatusSchema.safeParse({
      status: "shipped",
      tracking_url: "https://carrier.example:99999/track",
    }).success).toBe(false);
    expect(updateOrderStatusSchema.safeParse({
      status: "shipped",
      tracking_url: "https://carrier.example:65535/track",
    }).success).toBe(true);
    expect(updateOrderStatusSchema.safeParse({
      status: "shipped",
      tracking_url: ipv6TrackingUrl,
    }).success).toBe(true);
  });

  test("program introduction links require HTTPS at the database boundary", async () => {
    const title = `${run} video validation`;
    expect(() =>
      psql(`
        insert into programs (title, category, duration_days, price_inr, intro_video_url)
        values (${lit(title)}, 'custom', 30, 1999, 'http://example.com/program-intro');
      `),
    ).toThrow(/programs_intro_video_url_https_check/);
    expect(psql(`select count(*) from programs where title = ${lit(title)}`)).toBe("0");
  });

  test("the patient program catalog cannot read inactive programs", async () => {
    const activeId = crypto.randomUUID();
    const inactiveId = crypto.randomUUID();
    script(`
      insert into programs (id, title, category, duration_days, price_inr, is_active)
      values
        ('${activeId}', ${lit(`${run} active program`)}, 'custom', 30, 1999, true),
        ('${inactiveId}', ${lit(`${run} inactive program`)}, 'custom', 30, 1999, false);
    `);

    const patientToken = await accessToken("patient");
    const response = await api(patientToken, "GET", `/programs?id=in.(${activeId},${inactiveId})&select=id,is_active`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const visible = response.body as Array<{ id: string; is_active: boolean }>;
    expect(visible).toEqual([{ id: activeId, is_active: true }]);
  });
});
