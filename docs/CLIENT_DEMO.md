# Healthoraa Phase 1 demo runbook

**Status:** local, synthetic-data walkthrough. Payments are disabled. This runbook does not represent client acceptance, a production deployment, a live payment, or clinical approval.

## What this demo shows

The walkthrough covers three web roles against a freshly seeded local Supabase database:

1. **Admin:** inspect the synthetic practitioner record (its seeded status is for demo discovery only), plus sample program, catalog, banner, and order records.
2. **Practitioner:** review the synthetic schedule and patient history, then publish future availability.
3. **Patient:** browse the sample program catalog, open a program overview, browse products, view the seeded prescription/history, and submit a consultation request.

The consultation request intentionally ends as **Pending payment · not confirmed**. No payment provider is called, no gateway order is created, and no charge or refund occurs. The shop is a read-only catalog preview: it creates no cart, order, mock payment, or order-confirmation state. Product claims, prices, stock, and delivery terms are sample data awaiting client approval. The automated test suite has a separate test-only callback to exercise post-payment clinical transitions; do not use that callback as part of a client presentation or describe its result as a real payment.

## Local setup

Prerequisites: Node.js 20+, pnpm 11+, Docker, and the Supabase CLI from the repository dependencies.

From the repository root:

```bash
pnpm install
pnpm exec supabase start
pnpm exec supabase db reset
pnpm demo:seed-storage
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
- Open **Doctors** and identify Dr. Arishta Sharma as a synthetic demo record. Its seeded “Verified” status is not evidence of a real credential review; there are no submitted documents and review actions are disabled for this sample.
- Open **Programs**, **Shop**, **Orders**, and **Banners** to show the sample catalog and operational states. The sample banners are inactive because approved copy and artwork have not been supplied; the admin preview labels them and prevents activation. Identify all records as examples; do not imply that prices, labels, inventory, fulfillment, or provider transactions are client-approved or real.
- The admin program editor supports an optional HTTPS introduction-video link. Do not add a placeholder link to the presenter dataset; show a video only after the client supplies and approves the actual asset.
- Keep the demo read-only in these sections. The patient flow below creates a pending booking request; it does not require a payment action from admin.

### 2. Practitioner portal

- Open the practitioner portal and sign in as Dr. Arishta.
- Open **Schedule** and show the seeded availability. If the presenter needs to demonstrate publishing, choose **Publish Slots for Upcoming Week** and confirm that the upcoming slots appear.
- Schedule, queue, slot-preview, and consultation timestamps are displayed in IST; database timestamps remain UTC. Use the date and time shown in the portal during the walkthrough.
- Open **Patients** and show the seeded completed synthetic consultation and its example prescription/history. Do not present its clinical content as advice or an approved treatment plan.
- The new patient request in step 3 is unpaid and unconfirmed, so it must not be represented as a booked or completed consultation in the practitioner queue.

### 3. Patient portal

- Open the patient portal and sign in as Demo Patient.
- Open **Programs**, browse the sample listings, and open a detail page. The page omits price and explains that enrollment/payment are unavailable; no video is seeded, so do not imply an introduction video exists.
- Browse the read-only product catalog and show the existing seeded history/prescription. Explain that sample content and assets need client approval before release. Do not add items to a cart or present product prices, stock, or delivery terms as approved.
- Open **Consultations**, choose an available slot, complete the intake, and review the summary.
- Confirm the page says **No payment will be taken** before submitting.
- Submit **Booking request**. Confirm the visible state says **Pending payment · not confirmed**. This is the end of the booking journey for Phase 1; do not call it paid, confirmed, or scheduled with the practitioner.

## Reset and repeat

The patient booking consumes a local slot, and schedule publishing changes local data. To restore the seeded state before another rehearsal, close the portals and run:

```bash
pnpm exec supabase db reset
pnpm demo:seed-storage
```

Then reopen the portals. Repeat the same three role steps from the beginning. No manual database edits are part of the presenter workflow.

## Known limits and troubleshooting

- The native iOS/Android app has not been rehearsed on a device. The Expo web preview is not a substitute for the native patient sign-in journey; omit it from the client demo until a device rehearsal passes.
- The three Health Locker PDFs are synthetic demo files. `pnpm demo:seed-storage` uploads them and marks their matching seeded rows only in a loopback local Supabase instance; the bucket remains private.
- The seeded practitioner has no credential documents. Its database status exists so synthetic patient discovery can be demonstrated; it must never be described as an actual credential verification.
- Sample banners are intentionally inactive until the client supplies approved copy and artwork. Do not activate or present the example banner titles as client-approved campaigns.
- Razorpay checkout, order creation, capture, refund, reconciliation, and real charges are outside this demo. The database may contain seeded payment examples; those rows are synthetic and are not evidence of transactions.
- Practitioner identity, product facts, clinical copy, program pricing/content/video, enrollment CTA, contact route, images, legal disclosures, and payment/reservation policy need client confirmation. Do not invent or imply approval.
- If a portal cannot connect, first confirm the local Supabase stack is running and the portal `.env.local` contains the local URL and publishable key. Restart the affected Vite server after changing environment files.
- If accounts or sample records are missing, run the clean reset above and check that the repository's seed completed. Do not hand-edit the database to prepare the presentation.
- If a request fails, show the visible error and stop that step. Do not replace it with a fabricated success state.

## Evidence checklist

Record each rehearsal with the date, commit SHA, reset result, three role outcomes, and any visible errors. Keep screenshots in ignored `.audit/evidence/phase1/`; do not store real patient data, secrets, or provider credentials there.

| Check                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment enable flags/credentials absent in the local demo environment | Verified 2026-11-24 by a redacted name-only check of the portal and function env files plus the current process environment; no values were printed.                                                                                                                                                                                                                                                                                                                   |
| Clean database reset and type generation                              | Verified 2026-11-25 on merged commit `42a7eb2`; all migrations applied and generated DB types had no diff.                                                                                                                                                                                                                                                                                                                                                             |
| Full 33-test lifecycle, regression, and security run, rehearsal 1     | Passed after a clean reset on the PR #8 code; includes program discovery/video, inactive-program RLS, HTTPS validation, payment/refund recovery, private storage, push-token ownership, account-deletion retry, and cleanup of 1,001-record batches.                                                                                                                                                                                                                   |
| Full 33-test lifecycle, regression, and security run, rehearsal 2     | Passed 2026-11-25 after a second independent clean reset on merged commit `42a7eb2`.                                                                                                                                                                                                                                                                                                                                                                                   |
| Current Phase 1 candidate verification                                | Passed 2026-11-25 on merged PR #17 (`5e8cc42`): `pnpm turbo build` and `pnpm test:e2e` (34/34), including rejection of patient-supplied `demo_only` metadata by RLS. A read-only post-run check found 0 `E2E Sample` programs, 2 inactive sample banners, and 0 active sample banners.                                                                                                                                                                                 |
| Mobile quality and splash verification                                | Passed on merged PR #21 (`cfda53b`) and PR #22 (`9732aa7`): `pnpm --filter mobile lint`, `pnpm --filter mobile exec tsc --noEmit`, resolved Expo public config, and `pnpm turbo build`. Luna xhigh reviews approved both PRs. Native device launch and patient sign-in remain unverified.                                                                                                                                                                              |
| Focused responsive fixes                                              | PRs #19 and #20 merged after GPT-6 Luna xhigh code/UI reviews. The patient header action clears bottom navigation at 568×320; the practitioner save bar is absent for a clean form and visible while edits or save states need it. Viewports 375×812, 568×320, 768×1024, and 1280×720 had no horizontal overflow. This is targeted evidence, not a refreshed full UI score.                                                                                            |
| Current responsive UI review                                          | GPT-6 Luna xhigh reviewed patient, practitioner, and admin surfaces at 375×812, 768×1024, and 1280×720; focused checks confirmed the patient demo card and admin filter/drawer states. Patient 6/10, practitioner 6.5/10, admin 6.5/10 (overall 6.3/10). At 568×320, vertical scrolling is needed to reach the chat composer; no horizontal overflow was found. Client-approved content/brand, keyboard/screen-reader checks, and native-device rehearsal remain open. |
| Focused admin overview update (PR #26)                                | Merged as `01b6b80`. GPT-6 Luna xhigh review scored this screen 8.5/10. Synthetic-data preview at 320, 375, 768, and 1280px had no horizontal document overflow; tablet analytics disclosure and loaded desktop revenue chart were verified. The phone's fixed navigation crosses the lower KPI row until scroll. This is a focused screen score, not a refreshed full-portal score. Admin lint/build, Prettier, and diff checks passed; the build retains its existing bundle-size warning. |
| Representative responsive UI review (2026-11-26)                    | GPT-6 Luna xhigh scored Patient Today/programs/booking 7/10, practitioner queue 6.5/10, and admin overview/doctors 7/10 (representative-screen average 6.8/10, not a full-surface rescore). Screenshots are in ignored `.audit/evidence/phase1-full-review/`. Findings: the admin title collapses at 320px, practitioner queue details/actions crowd at 768px, booking slots lack an afternoon group and minimum 44px target, and client-approved program content remains pending. Native, keyboard, screen-reader, and formal contrast reviews remain open. |
| Targeted UI corrections                                              | The Phase 1 follow-up keeps the admin title readable at 320px, stacks practitioner queue actions below details at 768px, adds an Afternoon slot block, and verifies all booking time buttons are 44px tall. Browser evidence: `admin-overview-320x568-after.png`, `doctor-queue-tablet-after.png`, and `patient-booking-mobile-after.png` under ignored `.audit/evidence/phase1-full-review/`. |
| Responsive web review                                                 | Patient catalog/detail, patient shop, practitioner queue, and admin overview were rendered at 375×812, 768×1024, and 1280×720 with no browser console errors. Shop screenshots are in ignored `.gstack/browse-reports/2026-11-25-phase1-render/screenshots/`; earlier evidence is in `.audit/evidence/phase1/`.                                                                                                                                                        |
| Keyboard, screen-reader, and rendered native-app review               | Pending; see `docs/IMPLEMENTATION_PLAN.md` limitations.                                                                                                                                                                                                                                                                                                                                                                                                                |
