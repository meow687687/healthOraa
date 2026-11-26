import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  CHIEF_COMPLAINT_PREFIX,
  PERSONAS,
  PROGRAM_TITLE,
} from "./support/config";
import { lit, psql, script } from "./support/db";
import { sendPaymentCaptured } from "./support/webhook";
import { signInAs } from "./support/portals";
import { accessToken, api } from "./support/api";

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
} = {
  startedAt: "",
  slotsPublished: 0,
  consultationId: "",
  orderId: "",
  amountPaise: 0,
};

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
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      contexts.push(context);
      return context.newPage();
    };
    admin = await contextFor();
    doctor = await contextFor();
    patient = await contextFor();
    for (const page of [admin, doctor, patient]) {
      page.on("pageerror", (error) =>
        console.log(`[page error] ${error.message}`),
      );
    }
  });

  test.afterAll(async () => {
    for (const context of contexts) await context.close();
    cleanupSuiteRows();
    script(`delete from public.programs where title = ${lit(PROGRAM_TITLE)};`);
  });

  test("1. admin: Dr. Arishta is explicitly a demo record, and a sample program persists", async () => {
    await signInAs(admin, "admin");

    await admin.getByRole("button", { name: "Doctors", exact: true }).click();
    const doctorRow = admin.getByRole("row").filter({ hasText: "Arishta" });
    await expect(doctorRow).toContainText("Demo · not audited");
    await expect(doctorRow).not.toContainText("Verified");
    await admin
      .getByRole("button", {
        name: "Open credential audit for Dr. Arishta Sharma",
      })
      .click();
    const auditDrawer = admin.getByRole("dialog");
    await expect(
      auditDrawer.getByText("Demo · not audited", { exact: true }),
    ).toBeVisible();
    await expect(auditDrawer.getByRole("note")).toContainText(
      "not evidence of a real credential audit",
    );
    await expect(
      auditDrawer.getByRole("button", { name: "Sample status only" }),
    ).toBeDisabled();
    await expect(
      auditDrawer.getByRole("button", {
        name: "Review actions disabled for sample",
      }),
    ).toBeDisabled();
    await auditDrawer.getByRole("button", { name: "Close drawer" }).click();
    await admin.getByRole("button", { name: /^Verified/ }).click();
    await expect(
      admin.getByText("No matching practitioners", { exact: true }),
    ).toBeVisible();
    await expect(
      admin.getByText("No practitioners registered", { exact: true }),
    ).toHaveCount(0);
    await admin.getByRole("button", { name: /^All/ }).click();

    await admin.getByRole("button", { name: "Banners", exact: true }).click();
    const sampleBanner = admin
      .getByRole("article")
      .filter({ hasText: "Sample · PCOD nutrition support" });
    await expect(sampleBanner).toContainText("Sample preview · Program");
    await expect(sampleBanner).toContainText(
      "Demo content only. Add client-approved copy and artwork before activating.",
    );
    await expect(
      sampleBanner.getByRole("switch", {
        name: "Toggle Sample · PCOD nutrition support active; disabled until approved copy and artwork are added",
      }),
    ).toBeDisabled();

    await admin.getByRole("button", { name: "Programs", exact: true }).click();
    await admin
      .getByRole("button", { name: "Create Program", exact: true })
      .click();
    const form = admin
      .locator("form")
      .filter({ has: admin.locator("#program-title") });
    await admin.locator("#program-title").fill(PROGRAM_TITLE);
    const customCategory = form.getByRole("radio", {
      name: "Personalized Nutrition",
      exact: true,
    });
    await form
      .locator("label")
      .filter({ hasText: "Personalized Nutrition" })
      .click();
    await expect(customCategory).toBeChecked();
    await admin.locator("#program-duration").fill("30");
    await admin.locator("#program-price").fill("1999");
    await admin
      .locator("#program-description")
      .fill(
        "Example listing for automated validation; pending client-approved content.",
      );
    await admin
      .locator("#program-intro-video")
      .fill("http://example.com/program-intro");
    await form
      .getByRole("button", { name: "Create Program", exact: true })
      .click();
    await expect(
      form.getByText("Video links must use HTTPS.", { exact: true }),
    ).toBeVisible();
    await admin
      .locator("#program-intro-video")
      .fill("https://example.com/program-intro");
    await form
      .getByRole("button", { name: "Create Program", exact: true })
      .click();
    // Drawers stay mounted while closed, so wait for the new row in the table instead.
    await expect(
      admin.getByRole("row").filter({ hasText: PROGRAM_TITLE }),
    ).toBeVisible();

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
    const published = doctor.waitForResponse(
      (response) => response.url().includes("/rpc/publish_schedule"),
      { timeout: 30_000 },
    );
    await doctor
      .getByRole("button", {
        name: "Publish Slots for Upcoming Week",
        exact: true,
      })
      .click();
    const response = await published;
    expect(response.status()).toBe(200);
    // The count the RPC reports must match what it persisted.
    state.slotsPublished = Number(await response.json());
    expect(state.slotsPublished).toBeGreaterThan(0);

    const generated = Number(
      psql(
        `select count(*) from consultation_slots where practitioner_id = '${DOCTOR_ID}' and created_at >= '${state.startedAt}' and start_time > now()`,
      ),
    );
    expect(generated).toBe(state.slotsPublished);
    const rules = Number(
      psql(
        `select count(*) from practitioner_availability_rules where practitioner_id = '${DOCTOR_ID}'`,
      ),
    );
    expect(rules).toBeGreaterThan(0);

    // Stay on the queue for step 4, so new bookings arrive live.
    await doctor.getByRole("button", { name: "Queue", exact: true }).click();
  });

  test("3. patient: submits an unpaid booking request; a local mock callback enables the clinical test flow", async () => {
    const gatewayRequests: string[] = [];
    patient.on("request", (request) => {
      if (new URL(request.url()).hostname === "api.razorpay.com")
        gatewayRequests.push(request.url());
    });

    await signInAs(patient, "patient");
    await expect(
      patient.getByText("Healthoraa · Patient", { exact: true }),
    ).toBeVisible();
    await patient
      .getByRole("button", { name: "Programs", exact: true })
      .click();
    const programCard = patient
      .getByRole("article")
      .filter({ hasText: PROGRAM_TITLE });
    await expect(programCard).toBeVisible();
    await expect(programCard).toContainText("30 days");
    await expect(programCard).toContainText("pending client-approved content");
    await expect(programCard).not.toContainText("₹");
    await programCard
      .getByRole("button", { name: `View details for ${PROGRAM_TITLE}` })
      .click();
    await expect(
      patient.getByRole("heading", {
        name: PROGRAM_TITLE,
        exact: true,
        level: 2,
      }),
    ).toBeVisible();
    const introduction = patient.getByRole("link", {
      name: `Open the introduction video for ${PROGRAM_TITLE} in a new tab`,
    });
    await expect(introduction).toHaveAttribute(
      "href",
      "https://example.com/program-intro",
    );
    await expect(introduction).toHaveAttribute("target", "_blank");
    await expect(introduction).toHaveAttribute("rel", "noopener noreferrer");
    await expect(patient.getByRole("note")).toContainText(
      "Enrollment and payment are not available",
    );
    await patient
      .getByRole("button", { name: "Back to programs", exact: true })
      .click();
    await patient
      .getByRole("button", { name: "Consultations", exact: true })
      .click();
    const demoDoctor = patient
      .getByRole("article")
      .filter({ hasText: "Dr. Arishta Sharma" });
    await expect(demoDoctor).toContainText("Demo · not audited");
    await expect(demoDoctor).not.toContainText("NMC verified");
    await demoDoctor
      .getByRole("button", { name: "Preview booking", exact: true })
      .click();

    const drawer = patient.getByRole("dialog");
    await drawer
      .getByRole("button", { name: /^\d{1,2}:\d{2}/ })
      .first()
      .click();
    await drawer
      .getByRole("button", { name: "Continue to intake", exact: true })
      .click();

    await drawer.locator("#intake-age").fill("29");
    await drawer.locator("#intake-gender").selectOption("female");
    await drawer.locator("#intake-complaint").fill(complaint);
    await drawer.locator("#intake-duration").fill("3 months");
    await drawer
      .getByRole("button", { name: "Continue to summary", exact: true })
      .click();

    await expect(drawer.getByText(/No payment will be taken/)).toBeVisible();
    await drawer
      .getByRole("button", { name: "Submit booking request", exact: true })
      .click();
    await expect(
      drawer.getByText("Booking request saved", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      drawer.getByText("Pending payment · not confirmed", { exact: true }),
    ).toBeVisible();
    expect(gatewayRequests).toEqual([]);

    const booking = psql(
      `select id || '|' || booking_status || '|' || coalesce(payment_order_id, '')
       from consultations where patient_id = '${PATIENT_ID}' and created_at >= '${state.startedAt}'
       order by created_at desc limit 1`,
    ).split("|");
    expect(booking[1]).toBe("pending_payment");
    state.consultationId = booking[0];
    expect(booking[2]).toBe("");

    await doctor.reload();
    await expect(
      doctor.getByRole("button", { name: "Account menu", exact: true }),
    ).toBeVisible();
    await expect(doctor.getByText(/^\d+ consultations today$/)).toBeVisible();
    await expect(
      doctor.getByRole("article").filter({ hasText: runTag }),
    ).toHaveCount(0);

    const unpaidCompletionAttempt = await api(
      await accessToken("doctor"),
      "PATCH",
      `/consultations?id=eq.${state.consultationId}`,
      {
        status: "completed",
      },
    );
    expect(unpaidCompletionAttempt.status).not.toBe(200);
    expect(
      psql(
        `select status || '|' || booking_status from consultations where id = '${state.consultationId}'`,
      ),
    ).toBe("scheduled|pending_payment");

    expect(
      psql(
        `select count(*) from payment_transactions where consultation_id = '${state.consultationId}'`,
      ),
    ).toBe("0");
    expect(
      psql(
        `select count(*) from razorpay_order_logs where entity_type = 'consultation' and entity_id = '${state.consultationId}'`,
      ),
    ).toBe("0");

    const intakeRows = Number(
      psql(
        `select count(*) from patient_intake_forms where consultation_id = '${state.consultationId}'`,
      ),
    );
    expect(intakeRows).toBe(1);
    const slotBooked = psql(
      `select is_booked from consultation_slots where consultation_id = '${state.consultationId}'`,
    );
    expect(slotBooked).toBe("t");

    // Attach a test-only order to the pending booking so the local mock callback can exercise
    // downstream doctor flows. The patient UI above made no gateway request or payment order.
    state.orderId = `order_e2e_${runTag}_consultation`;
    state.amountPaise = Number(
      psql(
        `select round(amount_inr * 100)::bigint from consultations where id = '${state.consultationId}'`,
      ),
    );
    script(`
      update consultations set payment_order_id = ${lit(state.orderId)}
      where id = '${state.consultationId}' and booking_status = 'pending_payment';
      insert into razorpay_order_logs (order_id, user_id, amount_paise, currency, status, entity_type, entity_id)
      values (${lit(state.orderId)}, '${PATIENT_ID}', ${state.amountPaise}, 'INR', 'created', 'consultation', '${state.consultationId}');
    `);
    expect(
      psql(
        `select payment_order_id from consultations where id = '${state.consultationId}'`,
      ),
    ).toBe(state.orderId);
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

    expect(
      psql(
        `select booking_status from consultations where id = '${state.consultationId}'`,
      ),
    ).toBe("confirmed");
    expect(
      psql(
        `select status from payment_transactions where gateway_order_id = ${lit(state.orderId)}`,
      ),
    ).toBe("captured");

    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await expect(patient.getByText("Confirmed", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("4. doctor: the booking arrives in the live queue, and a signed Rx completes the consultation", async () => {
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await expect(card).toBeVisible({ timeout: 15_000 });

    await card
      .getByRole("button", { name: "Review Intake Form", exact: true })
      .click();
    const room = doctor.getByRole("region", { name: "Consultation room" });
    await expect(
      doctor.getByRole("heading", { level: 1, name: "Consultation room" }),
    ).toBeVisible();
    const prescriptionPane = room.getByRole("tabpanel", {
      name: "Prescription",
      exact: true,
    });
    await expect(
      prescriptionPane.getByText(
        "Start the consultation before issuing a prescription.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      prescriptionPane.getByRole("button", {
        name: "Issue & Sign Rx",
        exact: true,
      }),
    ).toHaveCount(0);
    await doctor.setViewportSize({ width: 375, height: 812 });
    await room
      .getByRole("tab", { name: "Follow-up chat", exact: true })
      .click();
    await expect(room.getByRole("status")).toContainText(
      "Follow-up chat becomes available after the consultation is completed.",
    );
    await expect(
      room.getByText("No messages in this conversation yet.", { exact: true }),
    ).toBeVisible();
    await doctor.setViewportSize({ width: 1440, height: 900 });
    await room
      .getByRole("button", { name: "Back to queue", exact: true })
      .click();
    await expect(
      doctor.getByRole("heading", { level: 1, name: "Queue" }),
    ).toBeVisible();

    const startButton = card.getByRole("button", { name: /Starts in \d+ min/ });
    await expect(startButton).toBeDisabled();
    const slotId = psql(
      `select slot_id from consultations where id = '${state.consultationId}'`,
    );
    const dueStart = new Date(Date.now() - 60_000).toISOString();
    const dueEnd = new Date(Date.now() + 29 * 60_000).toISOString();
    script(`
      update consultation_slots
      set start_time = '${dueStart}', end_time = '${dueEnd}'
      where id = '${slotId}';
      update consultations
      set slot_start = '${dueStart}', slot_end = '${dueEnd}'
      where id = '${state.consultationId}';
    `);
    await doctor.reload();
    const readyStartButton = doctor
      .getByRole("article")
      .filter({ hasText: runTag })
      .getByRole("button", { name: "Start Consultation", exact: true });
    await expect(readyStartButton).toBeEnabled();
    await readyStartButton.click();
    // Starting moves the consultation to in_progress in the database before the composer opens.
    await expect
      .poll(() =>
        psql(
          `select status from consultations where id = '${state.consultationId}'`,
        ),
      )
      .toBe("in_progress");
    await doctor.setViewportSize({ width: 375, height: 812 });
    await room
      .getByRole("tab", { name: "Follow-up chat", exact: true })
      .click();
    const followUpPanel = room.getByRole("tabpanel", {
      name: "Follow-up chat",
      exact: true,
    });
    const chatHeight = Number.parseFloat(
      await followUpPanel.evaluate(
        (element) => getComputedStyle(element).height,
      ),
    );
    expect(chatHeight).toBeLessThanOrEqual(448);
    const chatBottom = await followUpPanel.evaluate((element) =>
      Math.round(element.getBoundingClientRect().bottom),
    );
    const navTop = await doctor.locator("nav").evaluateAll((elements) => {
      const fixedNav = elements.find(
        (element) => getComputedStyle(element).position === "fixed",
      );
      return fixedNav
        ? Math.round(fixedNav.getBoundingClientRect().top)
        : Number.POSITIVE_INFINITY;
    });
    expect(chatBottom).toBeLessThan(navTop);
    await doctor.setViewportSize({ width: 1440, height: 900 });
    const composer = doctor.getByRole("tabpanel", {
      name: "Prescription",
      exact: true,
    });
    await composer
      .locator("#rx-diagnosis")
      .fill("E2E: PCOD with hormonal acne");
    await composer.getByLabel("Drug name").first().fill("Metformin 500mg");
    await composer.getByLabel("Dosage").first().fill("1 tablet");
    await composer
      .getByLabel("Frequency")
      .first()
      .selectOption("Twice daily after meals");
    await composer.getByLabel("Duration (days)").first().fill("30");
    await composer
      .getByRole("button", { name: "14 Days", exact: true })
      .click();
    await composer
      .getByRole("button", { name: "Issue & Sign Rx", exact: true })
      .click();
    await expect(
      doctor.getByText("Prescription signed and issued to patient portal"),
    ).toBeVisible({ timeout: 20_000 });

    expect(
      psql(
        `select c.status || '|' || (c.followup_expires_at = c.slot_end + interval '7 days') || '|' || p.followup_days
         from consultations c join prescriptions p on p.consultation_id = c.id
         where c.id = '${state.consultationId}' order by p.created_at desc limit 1`,
      ),
    ).toBe("completed|true|14");
    expect(
      psql(
        `select count(*) from prescriptions where consultation_id = '${state.consultationId}'`,
      ),
    ).toBe("1");
    expect(
      psql(
        `select count(*) from prescription_medicines m join prescriptions p on p.id = m.prescription_id where p.consultation_id = '${state.consultationId}' and m.name = 'Metformin 500mg'`,
      ),
    ).toBe("1");

    await expect(
      card.getByRole("button", { name: "Open Follow-up Chat", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("5. patient: the Rx is downloadable and the follow-up message arrives without a reload", async () => {
    // The history also holds seeded consultations, so scope every action to this run's row.
    const ours = patient.getByRole("listitem").filter({ hasText: runTag });
    await expect(
      ours.getByRole("button", { name: "Download Digital Rx", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await ours
      .getByRole("button", { name: "Download Digital Rx", exact: true })
      .click();
    const rx = patient.getByRole("dialog");
    await expect(rx).toContainText("E2E: PCOD with hormonal acne");
    await expect(rx).toContainText("Metformin 500mg");
    await rx
      .getByRole("button", { name: "Close preview", exact: true })
      .click();

    await ours
      .getByRole("button", { name: "Message doctor", exact: true })
      .click();
    const chat = patient.getByRole("dialog");
    await expect(
      chat.getByRole("heading", { name: /Message Dr\. Arishta/ }),
    ).toBeVisible();

    // Doctor sends from the portal while this drawer stays open.
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await card
      .getByRole("button", { name: "Open Follow-up Chat", exact: true })
      .click();
    const docChat = doctor.getByRole("tabpanel", {
      name: "Follow-up chat",
      exact: true,
    });
    await docChat
      .getByPlaceholder("Write a message to the patient")
      .fill(followupText);
    await docChat
      .getByRole("button", { name: "Send message", exact: true })
      .click();

    await expect(chat.getByText(followupText, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await doctor.waitForTimeout(2_000);
    expect(await docChat.getByText(followupText, { exact: true }).count()).toBe(
      1,
    );
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
    await doctor
      .getByRole("button", { name: "Back to queue", exact: true })
      .click();
    const card = doctor.getByRole("article").filter({ hasText: "Priya Mehta" });
    await card
      .getByRole("button", {
        name: "Write Prescription / View Notes",
        exact: true,
      })
      .click();
    const composer = doctor.getByRole("tabpanel", {
      name: "Prescription",
      exact: true,
    });
    // The composer starts from the saved prescription, not a blank form.
    await expect(composer.locator("#rx-diagnosis")).toHaveValue(
      "E2E: PCOD with hormonal acne",
    );
    await expect(composer.getByLabel("Drug name").first()).toHaveValue(
      "Metformin 500mg",
    );

    await composer.locator("#rx-diagnosis").fill("E2E corrected diagnosis");
    await composer
      .getByRole("button", { name: "Issue & Sign Rx", exact: true })
      .click();
    await expect(
      doctor.getByText("Prescription signed and issued to patient portal"),
    ).toBeVisible({ timeout: 20_000 });
    expect(
      psql(
        `select count(*) from prescriptions where consultation_id = '${state.consultationId}'`,
      ),
    ).toBe("2");

    // The patient's list picks the newest prescription, live.
    // The new version arrives by realtime. The preview is a snapshot, so reopen it until it shows the correction.
    const ours = patient.getByRole("listitem").filter({ hasText: runTag });
    await expect
      .poll(
        async () => {
          await ours
            .getByRole("button", { name: "Download Digital Rx", exact: true })
            .click();
          const rx = patient.getByRole("dialog");
          const text = (await rx.innerText()) ?? "";
          await rx
            .getByRole("button", { name: "Close preview", exact: true })
            .click();
          await patient.waitForTimeout(300);
          return (
            text.includes("E2E corrected diagnosis") &&
            !text.includes("E2E: PCOD with hormonal acne")
          );
        },
        { timeout: 30_000, intervals: [1_000] },
      )
      .toBe(true);
  });

  test("7. patient: synthetic Health Locker records open from private storage", async () => {
    await patient
      .getByRole("button", { name: "Health Locker", exact: true })
      .click();
    const sampleDocument = patient
      .getByRole("article")
      .filter({ hasText: "Signed Dermatology Prescription" });
    await expect(
      sampleDocument.getByText("Demo sample", { exact: true }),
    ).toBeVisible();

    const pdfResponse = patient.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/storage/v1/object/sign/medical-records/") &&
        response.status() === 200,
      { timeout: 15_000 },
    );
    await sampleDocument
      .getByRole("button", { name: "Preview Document", exact: true })
      .click();
    const preview = patient.getByRole("dialog");
    await expect(
      preview.getByText("Synthetic document preview", { exact: true }),
    ).toBeVisible();
    await expect(preview.getByRole("note")).toContainText(
      "Synthetic demo sample",
    );
    await expect(
      preview.getByText(
        "PDF · 849 B · The attached file is available to download.",
        { exact: true },
      ),
    ).toBeVisible();
    const downloadEvent = patient.waitForEvent("download");
    await preview
      .getByRole("button", { name: "Download", exact: true })
      .click();
    const [response, download] = await Promise.all([
      pdfResponse,
      downloadEvent,
    ]);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect(download.suggestedFilename()).toBe(
      "Signed Dermatology Prescription.pdf",
    );
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  });
});
