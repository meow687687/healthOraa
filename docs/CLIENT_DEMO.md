# Healthoraa Phase 1 demo runbook

**Status:** local, synthetic-data walkthrough. Payments are disabled. This runbook does not represent client acceptance, a production deployment, a live payment, or clinical approval.

## What this demo shows

The walkthrough covers three web roles against a freshly seeded local Supabase database:

1. **Admin:** review the verified synthetic practitioner and sample program, catalog, banner, and order records.
2. **Practitioner:** review the synthetic schedule and patient history, then publish future availability.
3. **Patient:** browse sample programs and products, view the seeded prescription/history, and submit a consultation request.

The consultation request intentionally ends as **Pending payment · not confirmed**. No payment provider is called, no gateway order is created, and no charge or refund occurs. The automated test suite has a separate test-only callback to exercise post-payment clinical transitions; do not use that callback as part of a client presentation or describe its result as a real payment.

## Local setup

Prerequisites: Node.js 20+, pnpm 11+, Docker, and the Supabase CLI from the repository dependencies.

From the repository root:

```bash
pnpm install
pnpm exec supabase start
pnpm exec supabase db reset
pnpm db:types
```

Copy the three portal environment examples and use the **local publishable/anon key** from `pnpm exec supabase status`:

```bash
cp apps/admin-portal/.env.example apps/admin-portal/.env.local
cp apps/doctor-portal/.env.example apps/doctor-portal/.env.local
cp apps/patient-portal/.env.example apps/patient-portal/.env.local
```

Set `VITE_DEMO_DATA=true` in each portal file. Keep `VITE_AUTH_ENABLED` enabled. Do not put a service-role key in a `VITE_*` variable. Leave all Razorpay enable flags and credentials unset; both the mobile client and server must remain disabled for Phase 1.

Start the portals in separate terminals:

```bash
pnpm --filter admin-portal dev
pnpm --filter doctor-portal dev
pnpm --filter patient-portal dev
```

Open the local URLs printed by Vite (default ports: admin `5180`, practitioner `5190`, patient `5200`). Use the development-only **Sign in as Demo Admin**, **Sign in as Dr. Arishta**, and **Sign in as Demo Patient** buttons. These identities and their records are synthetic local seed data; never reuse them on a shared or production environment.

## Presenter script

### 1. Admin portal

- Open the admin portal and sign in as Demo Admin.
- Open **Doctors** and show Dr. Arishta Sharma with the seeded verified status.
- Open **Programs**, **Shop**, **Orders**, and **Banners** to show the sample catalog and operational states. Identify the records as examples; do not imply that prices, labels, inventory, fulfillment, or provider transactions are client-approved or real.
- Keep the demo read-only in these sections. The patient flow below creates a pending booking request; it does not require a payment action from admin.

### 2. Practitioner portal

- Open the practitioner portal and sign in as Dr. Arishta.
- Open **Schedule** and show the seeded availability. If the presenter needs to demonstrate publishing, choose **Publish Slots for Upcoming Week** and confirm that the upcoming slots appear.
- Open **Patients** and show the seeded completed synthetic consultation and its example prescription/history. Do not present its clinical content as advice or an approved treatment plan.
- The new patient request in step 3 is unpaid and unconfirmed, so it must not be represented as a booked or completed consultation in the practitioner queue.

### 3. Patient portal

- Open the patient portal and sign in as Demo Patient.
- Show the synthetic program/product catalog and the existing seeded history/prescription. Explain that sample content and assets need client approval before release.
- Open **Consultations**, choose an available slot, complete the intake, and review the summary.
- Confirm the page says **No payment will be taken** before submitting.
- Submit **Booking request**. Confirm the visible state says **Pending payment · not confirmed**. This is the end of the booking journey for Phase 1; do not call it paid, confirmed, or scheduled with the practitioner.

## Reset and repeat

The patient booking consumes a local slot, and schedule publishing changes local data. To restore the seeded state before another rehearsal, close the portals and run:

```bash
pnpm exec supabase db reset
```

Then reopen the portals. Repeat the same three role steps from the beginning. No manual database edits are part of the presenter workflow.

## Known limits and troubleshooting

- The native iOS/Android app has not been rehearsed on a device. The Expo web preview is not a substitute for the native patient sign-in journey; omit it from the client demo until a device rehearsal passes.
- Razorpay checkout, order creation, capture, refund, reconciliation, and real charges are outside this demo. The database may contain seeded payment examples; those rows are synthetic and are not evidence of transactions.
- Practitioner identity, product facts, clinical copy, program pricing/content, images, legal disclosures, and payment/reservation policy need client confirmation. Do not invent or imply approval.
- If a portal cannot connect, first confirm the local Supabase stack is running and the portal `.env.local` contains the local URL and publishable key. Restart the affected Vite server after changing environment files.
- If accounts or sample records are missing, run the clean reset above and check that the repository's seed completed. Do not hand-edit the database to prepare the presentation.
- If a request fails, show the visible error and stop that step. Do not replace it with a fabricated success state.

## Evidence checklist

Record each rehearsal with the date, commit SHA, reset result, three role outcomes, and any visible errors. Keep screenshots in ignored `.audit/evidence/phase1/`; do not store real patient data, secrets, or provider credentials there.

| Check | Result |
|---|---|
| Payment enable flags/credentials absent in the local demo environment | Verified 2026-11-24 by a redacted name-only check of the portal and function env files plus the current process environment; no values were printed. |
| Clean database reset and type generation | Verified 2026-11-24; all migrations applied and generated DB types had no diff. |
| Full 19-test lifecycle, regression, and security run, rehearsal 1 | Passed 2026-11-24 after clean reset. |
| Full 19-test lifecycle, regression, and security run, rehearsal 2 | Passed 2026-11-24 after a second independent clean reset. |
| Responsive web review | Passed 2026-11-24 across patient, practitioner, and admin at 375×812, 768×1024, and 1280×720; final browser consoles showed no errors. Screenshots are in ignored `.audit/evidence/phase1/`. |
| Keyboard, screen-reader, and rendered native-app review | Pending; see `docs/IMPLEMENTATION_PLAN.md` limitations. |
