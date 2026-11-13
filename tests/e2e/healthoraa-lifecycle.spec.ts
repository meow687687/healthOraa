import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { CHIEF_COMPLAINT_PREFIX, PERSONAS, PROGRAM_TITLE } from "./support/config";
import { lit, psql, script } from "./support/db";
import { sendPaymentCaptured } from "./support/webhook";
import { signInAs } from "./support/portals";

// End-to-end lifecycle across the admin, doctor and patient portals, against the local Supabase
// stack and the three Vite dev servers. Steps run in order and share state.

const runTag = `run-${Date.now()}`;
const complaint = `${CHIEF_COMPLAINT_PREFIX} ${runTag}: cystic acne and irregular cycles`;
const followupText = `E2E follow-up ${runTag}: take metformin with dinner tonight.`;
const DOCTOR_ID = PERSONAS.doctor.id;
const PATIENT_ID = PERSONAS.patient.id;

const state: {
  startedAt: string;
  slotsPublished: number;
  consultationId: string;
  orderId: string;
  amountPaise: number;
} = { startedAt: "", slotsPublished: 0, consultationId: "", orderId: "", amountPaise: 0 };

// Removes rows from earlier runs of this suite. Booked slots are freed so they can be booked again.
const cleanupSuiteRows = (): void => {
  const match = `chief_complaint like ${lit(`${CHIEF_COMPLAINT_PREFIX}%`)}`;
  script(`
    update consultation_slots set is_booked = false, consultation_id = null
      where consultation_id in (select id from consultations where ${match});
    delete from payment_transactions
      where consultation_id in (select id from consultations where ${match})
         or gateway_payment_id like 'pay_e2e%';
    delete from razorpay_order_logs
      where entity_id in (select id from consultations where ${match});
    delete from patient_intake_forms where ${match};
    delete from consultations where ${match};
  `);
};

let admin: Page;
let doctor: Page;
let patient: Page;
let contexts: BrowserContext[] = [];

test.describe.serial("Healthoraa clinical and commercial lifecycle", () => {
  test.beforeAll(async ({ browser }) => {
    cleanupSuiteRows();
    script(`delete from programs where title = ${lit(PROGRAM_TITLE)};`);
    state.startedAt = psql("select now()");

    const contextFor = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      return context.newPage();
    };
    admin = await contextFor();
    doctor = await contextFor();
    patient = await contextFor();
    for (const page of [admin, doctor, patient]) {
      page.on("pageerror", (error) => console.log(`[page error] ${error.message}`));
    }
  });

  test.afterAll(async () => {
    for (const context of contexts) await context.close();
    cleanupSuiteRows();
  });

  test("1. admin: Dr. Arishta is verified, and the 30-Day Gut Reset program persists", async () => {
    await signInAs(admin, "admin");

    await admin.getByRole("button", { name: "Doctors", exact: true }).click();
    await expect(admin.getByRole("row").filter({ hasText: "Arishta" })).toContainText("Verified");

    await admin.getByRole("button", { name: "Programs", exact: true }).click();
    await admin.getByRole("button", { name: "Create Program", exact: true }).click();
    const form = admin.locator("form").filter({ has: admin.locator("#program-title") });
    await admin.locator("#program-title").fill(PROGRAM_TITLE);
    await form.getByRole("radio", { name: "Custom" }).click();
    await admin.locator("#program-duration").fill("30");
    await admin.locator("#program-price").fill("1999");
    await admin.locator("#program-description").fill("Thirty days of gut-friendly meals, fibre targets and check-ins.");
    await form.getByRole("button", { name: "Create Program", exact: true }).click();
    // Drawers stay mounted while closed, so wait for the new row in the table instead.
    await expect(admin.getByRole("row").filter({ hasText: PROGRAM_TITLE })).toBeVisible();

    const persisted = psql(
      `select title || '|' || price_inr || '|' || duration_days || '|' || is_active from programs where title = ${lit(PROGRAM_TITLE)}`,
    );
    expect(persisted).toBe(`${PROGRAM_TITLE}|1999.00|30|true`);
  });

  test("2. doctor: publishing generates the upcoming week's bookable slots", async () => {
    await signInAs(doctor, "doctor");

    await doctor.getByRole("button", { name: "Schedule", exact: true }).click();
    // Wait for the publish RPC itself. The confirmation toast leaves the screen after 3.5 seconds and can
    // be missed under load, so the database count below is the real check.
    const published = doctor.waitForResponse((response) => response.url().includes("/rpc/publish_schedule"), { timeout: 30_000 });
    await doctor.getByRole("button", { name: "Publish Slots for Upcoming Week", exact: true }).click();
    expect((await published).status()).toBe(200);
    state.slotsPublished = Number(
      psql(
        `select count(*) from consultation_slots where practitioner_id = '${DOCTOR_ID}' and created_at >= '${state.startedAt}' and start_time > now()`,
      ),
    );
    expect(state.slotsPublished).toBeGreaterThan(0);

    const generated = Number(
      psql(
        `select count(*) from consultation_slots where practitioner_id = '${DOCTOR_ID}' and created_at >= '${state.startedAt}' and start_time > now()`,
      ),
    );
    expect(generated).toBe(state.slotsPublished);
    const rules = Number(psql(`select count(*) from practitioner_availability_rules where practitioner_id = '${DOCTOR_ID}'`));
    expect(rules).toBeGreaterThan(0);

    // Stay on the queue for step 4, so new bookings arrive live.
    await doctor.getByRole("button", { name: "Queue", exact: true }).click();
  });

  test("3. patient: books a generated slot, pays through checkout, and the webhook confirms it", async () => {
    await signInAs(patient, "patient");
    await patient.getByRole("button", { name: "Consultations", exact: true }).click();
    await patient.getByRole("button", { name: "Book consultation", exact: true }).first().click();

    const drawer = patient.getByRole("dialog");
    await drawer.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first().click();
    await drawer.getByRole("button", { name: "Continue to intake", exact: true }).click();

    await drawer.locator("#intake-age").fill("29");
    await drawer.locator("#intake-gender").selectOption("female");
    await drawer.locator("#intake-complaint").fill(complaint);
    await drawer.locator("#intake-duration").fill("3 months");
    await drawer.getByRole("button", { name: "Continue to summary", exact: true }).click();

    await drawer.getByRole("button", { name: "Proceed to Pay with Razorpay", exact: true }).click();
    await expect(drawer.getByText("Awaiting payment verification")).toBeVisible({ timeout: 20_000 });

    const booking = psql(
      `select id || '|' || booking_status || '|' || payment_order_id from consultations where chief_complaint = ${lit(complaint)}`,
    ).split("|");
    expect(booking[1]).toBe("pending_payment");
    state.consultationId = booking[0];
    state.orderId = booking[2];

    const intakeRows = Number(psql(`select count(*) from patient_intake_forms where consultation_id = '${state.consultationId}'`));
    expect(intakeRows).toBe(1);
    const slotBooked = psql(
      `select is_booked from consultation_slots where consultation_id = '${state.consultationId}'`,
    );
    expect(slotBooked).toBe("t");

    // Mock checkout: the gateway confirms the captured payment to the webhook.
    const [amountPaise, currency] = psql(
      `select amount_paise || '|' || currency from razorpay_order_logs where order_id = ${lit(state.orderId)}`,
    ).split("|");
    state.amountPaise = Number(amountPaise);
    const result = await sendPaymentCaptured({
      orderId: state.orderId,
      amountPaise: state.amountPaise,
      currency,
      paymentId: `pay_e2e_${runTag}`,
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.status).toBe("captured");

    expect(psql(`select booking_status from consultations where id = '${state.consultationId}'`)).toBe("confirmed");
    expect(psql(`select status from payment_transactions where gateway_order_id = ${lit(state.orderId)}`)).toBe("captured");

    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(patient.getByText("Confirmed", { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("4. doctor: the booking arrives in the live queue, and a signed Rx completes the consultation", async () => {
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card.getByRole("button", { name: "Start Consultation", exact: true }).click();
    // Starting moves the consultation to in_progress in the database before the composer opens.
    await expect.poll(() => psql(`select status from consultations where id = '${state.consultationId}'`)).toBe(
      "in_progress",
    );
    const composer = doctor.getByRole("region", { name: "Prescription composer" });
    await composer.locator("#rx-diagnosis").fill("E2E: PCOD with hormonal acne");
    await composer.getByLabel("Drug name").first().fill("Metformin 500mg");
    await composer.getByLabel("Dosage").first().fill("1 tablet");
    await composer.getByLabel("Frequency").first().selectOption("Twice daily after meals");
    await composer.getByLabel("Duration (days)").first().fill("30");
    await composer.getByRole("button", { name: "Issue & Sign Rx", exact: true }).click();
    await expect(doctor.getByText("Prescription signed and issued to patient portal")).toBeVisible({ timeout: 20_000 });

    expect(
      psql(
        `select status || '|' || (followup_expires_at > now() + interval '6 days') from consultations where id = '${state.consultationId}'`,
      ),
    ).toBe("completed|true");
    expect(psql(`select count(*) from prescriptions where consultation_id = '${state.consultationId}'`)).toBe("1");
    expect(
      psql(
        `select count(*) from prescription_medicines m join prescriptions p on p.id = m.prescription_id where p.consultation_id = '${state.consultationId}' and m.name = 'Metformin 500mg'`,
      ),
    ).toBe("1");

    await expect(card.getByRole("button", { name: "Open Follow-up Chat", exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test("5. patient: the Rx is downloadable and the follow-up message arrives without a reload", async () => {
    // The history also holds seeded consultations, so scope every action to this run's row.
    const ours = patient.getByRole("listitem").filter({ hasText: runTag });
    await expect(ours.getByRole("button", { name: "Download Digital Rx", exact: true })).toBeVisible({ timeout: 20_000 });
    await ours.getByRole("button", { name: "Download Digital Rx", exact: true }).click();
    const rx = patient.getByRole("dialog");
    await expect(rx).toContainText("E2E: PCOD with hormonal acne");
    await expect(rx).toContainText("Metformin 500mg");
    await rx.getByRole("button", { name: "Close preview", exact: true }).click();

    await ours.getByRole("button", { name: "Message doctor", exact: true }).click();
    const chat = patient.getByRole("dialog");
    await expect(chat.getByRole("heading", { name: /Message Dr\. Arishta/ })).toBeVisible();

    // Doctor sends from the portal while this drawer stays open.
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await card.getByRole("button", { name: "Open Follow-up Chat", exact: true }).click();
    const docChat = doctor.getByRole("region", { name: "Follow-up chat" });
    await docChat.getByPlaceholder("Write a message to the patient").fill(followupText);
    await docChat.getByRole("button", { name: "Send message", exact: true }).click();

    await expect(chat.getByText(followupText, { exact: true })).toBeVisible({ timeout: 15_000 });
    await doctor.waitForTimeout(2_000);
    expect(await docChat.getByText(followupText, { exact: true }).count()).toBe(1);
    expect(
      psql(
        `select count(*) from consultation_messages where consultation_id = '${state.consultationId}' and content = ${lit(followupText)}`,
      ),
    ).toBe("1");
  });
  test("6. doctor reopens the saved Rx, corrects it, and the patient sees the correction", async () => {
    // Close the patient chat drawer, so the Rx preview is the only open dialog.
    await patient.keyboard.press("Escape");
    await doctor.keyboard.press("Escape");

    // Step 5 left the consultation room open on its chat pane. Return to the queue first.
    await doctor.getByRole("button", { name: "Back to queue", exact: true }).click();
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await card.getByRole("button", { name: "Write Prescription / View Notes", exact: true }).click();
    const composer = doctor.getByRole("region", { name: "Prescription composer" });
    // The composer starts from the saved prescription, not a blank form.
    await expect(composer.locator("#rx-diagnosis")).toHaveValue("E2E: PCOD with hormonal acne");
    await expect(composer.getByLabel("Drug name").first()).toHaveValue("Metformin 500mg");

    await composer.locator("#rx-diagnosis").fill("E2E corrected diagnosis");
    await composer.getByRole("button", { name: "Issue & Sign Rx", exact: true }).click();
    await expect(doctor.getByText("Prescription signed and issued to patient portal")).toBeVisible({ timeout: 20_000 });
    expect(psql(`select count(*) from prescriptions where consultation_id = '${state.consultationId}'`)).toBe("2");

    // The patient's list picks the newest prescription, live.
    // The new version arrives by realtime. The preview is a snapshot, so reopen it until it shows the correction.
    const ours = patient.getByRole("listitem").filter({ hasText: runTag });
    await expect
      .poll(
        async () => {
          await ours.getByRole("button", { name: "Download Digital Rx", exact: true }).click();
          const rx = patient.getByRole("dialog");
          const text = (await rx.innerText()) ?? "";
          await rx.getByRole("button", { name: "Close preview", exact: true }).click();
          await patient.waitForTimeout(300);
          return text.includes("E2E corrected diagnosis") && !text.includes("E2E: PCOD with hormonal acne");
        },
        { timeout: 30_000, intervals: [1_000] },
      )
      .toBe(true);
  });
});
