# Healthoraa: Client-Ready Implementation Plan

## Outcome

Bring the existing work to a reviewable, repeatable client demo, then prepare a controlled paid pilot and broader launch. Phase 1 is a **non-transactional demo**: no live gateway orders or charges, no mock payment represented as real, and no incomplete flow described as confirmed.

“10/10” means every gate for the current engineering stage passes with evidence. A score is not a claim that every item in the master PRD is finished, that the client has accepted the work, or that production infrastructure is deployed.

## Contract and phase terminology

- The project PDF describes a ₹70,000 turnkey delivery through contract milestones M1–M4. Its acceptance signature line is blank in the copy reviewed here; do not describe the document as signed or accepted without confirmation.
- The PDF separately labels optional post-launch support retainers “Phase 2” (₹8,000/month) and “Phase 3” (₹14,000/month). This roadmap uses **engineering Phase 1/2/3** for demo readiness, paid-pilot readiness, and broader-launch readiness. These are not contract amendments, additional paid build phases, or retainer selections.
- The contract names Razorpay **or** Cashfree. The user confirmed on 2026-11-26 that the client selected Razorpay and the Healthoraa-owned sandbox account is ready. Sandbox credentials are not configured in this isolated workspace; payment stays disabled until the sandbox lifecycle is verified. Do not add Cashfree or quote a new phase without approval.
- Client data, prices, credentials, program copy, video, product/legal metadata, and compliance decisions remain client inputs. Use synthetic demo data and explicitly identified examples until those inputs are approved.

## Current baseline

- The repo contains four user interfaces: patient mobile, patient web, practitioner portal, and admin portal, plus shared packages and Supabase migrations/Edge Functions.
- Payment and checkout hardening began in local commit `16caaf7`. PR #3 was squash-merged into `main` on 2026-11-25 as `52086dd07c5f39a783fe41d23dab6193da6c610f`.
- Independent code and security re-reviews found several payment, file-retention, checkout, and token-ownership gaps; PR #3 closed them with database-time reservation confirmation, durable partial-refund review, compensating Health Locker cleanup, scoped orphan recovery, protected checkout dismissal, realtime program refresh, and atomic device-token transfer. Sign-out still requires successful remote token removal; this is intentional so an offline device cannot remain registered for account notifications. Other fixes include stale-day booking selection, auth lookup races, unavailable cart removal, disabling patient sign-in in browser builds, chat refresh/draft handling, payment single-flight, plan retry, push-token migration backfill, and Expo receipt processing. Browser storage removes any legacy Supabase key without reading it. An expired checkout response cancels and releases its reservation, returns no order ID, and rotates the client idempotency key before deliberate retry; a failed key write cannot activate an in-memory attempt. The database caps each patient at three active pending order reservations. A late capture now requests an idempotent full refund, processes refund lifecycle webhooks, retries transient API failures, and retains an admin fallback. Unresolved Expo receipts age out with a visible error so they cannot block newer batches.
- An earlier full web UI review covered the portals at 375×812, 768×1024, and 1280×720. Patient scores 8/10, practitioner 8.5/10, admin 8/10; overall purposeful score 8/10 and distinctiveness 7.5/10. A follow-up rendered pass captured patient Home and admin Payments at 1280px desktop and found duplicate filter counts. The screenshot showed labels such as “All 3 3”; this and the same issue in Practitioners were fixed by letting `DataTable` render each count once. Source review also found missing mobile heading roles, a Health Locker shortcut that stopped at Profile, and awkward home greeting copy; these are fixed. The post-fix patient program catalog/detail, practitioner queue, admin overview, and read-only patient shop were rendered at 375×812, 768×1024, and 1280×720 with no browser console errors. The shop shows category-level sample titles and no prices, stock, health claims, cart, or order confirmation. The refund recovery actions had no synthetic review records available for visual inspection. Native app screens, keyboard traversal, screen-reader behavior, and automated contrast coverage remain to be recorded. Screenshots are in ignored `.audit/evidence/phase1/`, `.gstack/browse-reports/2026-11-25-phase1-ui/screenshots/`, and `.gstack/browse-reports/2026-11-25-phase1-render/screenshots/`.
- Verification at PR #3 head `7639fed`: `pnpm turbo build`, admin ESLint, TypeScript checks for mobile, patient, practitioner, admin, and E2E code, Deno checks for the changed Edge Functions, `pnpm exec supabase db reset`, and `pnpm db:types` passed. `pnpm test:e2e` passed 31/31, covering the lifecycle, payment/refund races, account erasure, private records, and push-token boundaries. Luna code and database reviews found no actionable issues; the UI audit findings above were fixed and the code re-review passed. GitHub currently has no configured CI checks. The admin build emits a 698.86 kB initial JavaScript chunk (202.97 kB gzip) and a 378.99 kB chart chunk (108.51 kB gzip); Vite still warns about the raw initial chunk, and no client-approved bundle budget exists. Native device runtime and the manual presenter walkthrough remain open.
- PR #8 added the patient program catalog/detail and was squash-merged on 2026-11-25 as `42a7eb2`. It reads active programs only, filters by category/search, supports an optional HTTPS video link, omits unapproved prices, and does not start enrollment/payment. Seeded program copy is explicitly sample wording. A clean reset/type generation and the full 33-test E2E suite passed twice on the PR #8 code, including after merge; coverage includes admin HTTPS validation, patient discovery/detail/video, the database URL constraint, and inactive-program RLS. GPT-6 Luna xhigh source/UI review approved the change with no actionable findings. GitHub has no CI checks configured. The responsive post-change rendering is recorded above.
- PR #11 was squash-merged on 2026-11-25 as `f96ca73`. It improves patient page headings, keyboard-operable admin category radios, form error associations and focus, catalog/booking focus transitions, filter-result announcements, contrast, and mobile touch targets. Session-only locker uploads are labeled in the list and preview; missing program descriptions are omitted, and unapproved prices remain hidden. `pnpm turbo build`, admin lint, shared-config ESLint, and Prettier checks passed; independent GPT-6 Luna xhigh review approved the published PR. CodeRabbit findings were fixed in commits `16ec81f` and `2905215`. E2E was not rerun; the prior 33-test run on PR #8 passed twice. Keyboard, screen-reader, and native checks remain open; responsive evidence has been refreshed as noted above.
- PR #13 was squash-merged on 2026-11-25 as `aba603d`. It makes the patient web shop a read-only preview, removes patient-web cart/order writes, hides unapproved prices and claims, and removes program prices from the mobile home category sheet. Catalog failures now have a visible alert and retry rather than silently showing fallback products. The build and responsive browser review passed, and GPT-6 Luna xhigh approved with a warning: the existing Supabase product-table grants still expose price/stock columns directly, and the native Expo shop still contains checkout code. The runbook excludes Expo from the client walkthrough; the database boundary and native commerce flow remain pre-shared-deployment gates.
- PR #14 was squash-merged on 2026-11-25 as `6f01786`. Practitioner portal routes now expose their own H1 (Queue, Schedule, Patients, or Profile) while retaining the practitioner’s name and registration number. The nested Patients section is labeled “Patient list” to avoid repeating the route heading. The full build passed and GPT-6 Luna xhigh approved with no remaining findings; the refreshed practitioner browser screenshot is pending.
- PR #15 was squash-merged on 2026-11-25 as `d04b373`. It updates the native app display name to Healthoraa while keeping its Expo slug and deep-link scheme stable. The checked-in icon and splash are Expo starter artwork, and approved native font/brand assets have not been supplied. Replace those assets only after client approval; native device launch remains unreviewed.
- PR #16 was squash-merged on 2026-11-25 as `ebe4bfb7b62cde814490bd5233c9ec9a9bf8b4e3`, recording the native app identity merge.
- PR #17 was squash-merged on 2026-11-25 as `5e8cc42fa61ba79b42e7fe5d2e868874ebf8d64a`. It makes seeded Health Locker previews visibly synthetic while keeping the bucket private and download links short-lived; blocks patients from setting the demo-provenance marker through RLS; marks sample banners inactive; distinguishes seeded practitioner records from completed credential audits in admin and patient discovery; corrects scheduled-chat and room states; invalidates pending consultation starts on queue unmount; and removes the E2E-created sample program after the suite. `pnpm turbo build` and `pnpm test:e2e` (34/34) passed, including a check that patient-supplied `demo_only` metadata is rejected. A read-only local check after E2E reports no remaining `E2E Sample` program, two inactive sample banners, and no active sample banners. GPT-6 Luna xhigh code review approved the changes after the credential-claim, navigation-race, short-viewport, and patient-metadata issues were fixed. GitHub had no configured CI checks; CodeRabbit’s automated check passed, but its inline review comments could not be posted because of a GitHub timeout. Latest UI-specific review scored patient 6/10, practitioner 6.5/10, admin 6.5/10 (overall 6.3/10); focused checks confirmed the practitioner list, drawer, patient demo-card labels, and short-height chat layout. At 568×320, vertical scrolling is needed to reach the composer; there is no horizontal overflow. Current design still relies on generic repeated cards/status pills and client-owned program/product content and brand assets are not approved. Native mobile remains source-only.
- PR #18 was squash-merged as `eca070c349e3d1978e725c537d153403bafb0308` to record Phase 1 merge evidence. PR #19 (`e2e687045cdba95fddc7d36d58d58313ed34bca8`) reduces responsive overlap in the patient header and practitioner save bar. The reviewed viewport set (375×812, 568×320, 768×1024, and 1280×720) had no horizontal overflow; the patient call-to-action clears the bottom navigation at 568×320. GPT-6 Luna xhigh code and UI reviews approved. PR #20 (`02aa3bdb8a524137c30652e870f5fe61578a20d7`) hides the practitioner profile save bar while the form is clean and keeps it visible for dirty, pending, submitting, or error states; the 375×812 clean/dirty browser review and GPT-6 Luna xhigh code/UI reviews passed. PR #21 (`cfda53b1e0175ee2e259eec8997474c653a64393`) adds Expo ESLint configuration covering the full mobile app tree and fixes its baseline findings; `pnpm --filter mobile lint`, `pnpm --filter mobile exec tsc --noEmit`, and `pnpm turbo build` passed, and GPT-6 Luna xhigh approved with no findings. PR #22 (`9732aa7b6267f337abb4f399f466607a1e75212a`) removes the Expo starter splash image and uses the existing Aura Dark `#090A0F` canvas; resolved Expo config, mobile lint/typecheck, and the full build passed, and GPT-6 Luna xhigh approved with no findings. These targeted responsive checks do not replace the full UI score or native-device walkthrough. No GitHub Actions checks are configured.
- PR #24 (`a3ad798`) adds skip links to the patient, practitioner, and admin web portals. PR #25 (`0e990bb`) improves route-focus handling, practitioner-room focus return, form errors and touch targets, and patient demo clarity. PR #26 was squash-merged on 2026-11-25 UTC as `01b6b808dc22f751ed27c01d1230a59b898bc50b`; it refines the admin overview hierarchy, adds a tablet analytics disclosure, clarifies rolling 7-day comparisons, makes zero funnel values visually empty, and labels both revenue series. Admin lint, admin build, Prettier, and diff checks passed. The focused admin overview review scored 8.5/10; this is not a refreshed score for all web portals. Synthetic-data rendering at 320, 375, 768, and 1280px found no horizontal document overflow. The mobile fixed navigation still crosses the lower KPI row until the presenter scrolls. The PR's CodeRabbit check failed because its review started after the PR had closed; no GitHub Actions checks are configured.
- PR #27 was squash-merged as `23408c37`. Practitioner schedule and consultation dates use Asia/Kolkata boundaries and display IST labels, while database timestamps remain UTC.
- A representative GPT-6 Luna xhigh UI review on 2026-11-26 scored patient 7/10, practitioner 6.5/10, and admin 7/10 (average 6.8/10). It covered Patient Today, program discovery and booking; the practitioner queue; and the admin overview and doctor list at responsive widths. The prior 6.3/10 full-surface score remains the last full review because the schedule, consultation room, locker/chat, and most admin operations were not reviewed. Native screens, keyboard traversal, screen-reader behavior, and formal contrast checks remain open. Screenshots are in ignored `.audit/evidence/phase1-full-review/`.
- Follow-up UI fixes in this Phase 1 branch keep the admin page title readable at 320px, stack practitioner queue details/actions below the 1024px breakpoint, add the missing afternoon booking group, and make slot buttons at least 44px tall. Rendered checks at 320×568, 375×812, and 768×1024 confirm the targeted fixes; the wider full-surface audit is still open.
- The Expo web preview stayed on its server-rendered loading shell and did not hydrate in the headless browser. Patient sign-in is intentionally unavailable in browser builds because they cannot protect refresh tokens. Do not count the mobile runtime journey as rehearsed yet.
- Razorpay remains fail-closed: the mobile app needs its explicit enable flag and key ID, while `create-razorpay-order` independently requires its server enable flag and credentials. No payment was started in the local walkthrough. Payment-disabled behavior is covered by the passing lifecycle/security suite; sandbox proof and a named reconciliation operator remain Phase 2 gates.
- Razorpay Orders do not provide an order-expiry field that tracks a local stock or booking reservation deadline ([create-order API](https://razorpay.com/docs/api/orders/create/)). A late capture now triggers a full-refund request with the provider's idempotency header ([refund API](https://razorpay.com/docs/api/refunds/create-normal/)); `refund.created`, `refund.processed`, and `refund.failed` update the refund audit ([refund webhook events](https://razorpay.com/docs/webhooks/refunds/)). Temporary refund API failures return a retryable webhook response and reuse the same idempotency key ([Razorpay retry guidance](https://razorpay.com/docs/webhooks/best-practices/)); permanent failures remain in the manual admin queue. Live checkout stays off until this flow is confirmed in the selected gateway account's sandbox and an operator owns reconciliation.

The master [PRD](PRD.md) and project agreement PDF remain scope references. This document supplies proposed engineering-stage boundaries and evidence gates; it does not record client acceptance.

## Phase 1 scope

### Included in the client review

Use three end-to-end stories across the current four interfaces:

1. **Patient:** sign in, discover a program and practitioner, inspect available consultation slots, review the shop, and inspect the health vault/account using clearly identified demo records.
2. **Practitioner:** sign in, review the work queue/calendar, open a seeded patient record, and demonstrate the supported consultation or program workflow.
3. **Admin:** sign in, review practitioner status, update a demo catalog record, inspect a demo order, and review the payment audit/refund queue.

The presenter should show each surface only where its journey works end to end. Anything else is labeled prototype or omitted from the client walkthrough.

### PRD and contract crosswalk

| Scope ID | Requirement from PRD / agreement | Phase 1 client demo | Phase 2 paid-pilot readiness | Phase 3 broader launch | Why deferred from the demo |
|---|---|---|---|---|---|
| S1 | Three interfaces and four mobile tabs | Demonstrate only working paths with synthetic identities | Operate approved patient and practitioner cohorts | Store releases, wider onboarding, support and service-level monitoring | Native device sign-in and store delivery need device/account access and a rehearsed release path. |
| M1 | Home banners, quick actions, four program categories, practitioners, products | Browse seeded content; label sample data | Publish client-approved copy, prices, verified practitioners and products | Personalize discovery from pilot evidence | Personalization needs approved live content and pilot behavior data. |
| M2 | Program discovery/detail, client video, enroll and contact actions | Show a clear demo detail path; no invented outcomes, prices or credentials | Publish client-supplied 2–3 minute video, approved facts, CTA and contact route | Improve content and retention from measured use | Video, approved claims, prices, and contact details are client-owned inputs. |
| M3 | Consultation filters, credentials, 30/45-minute slots, intake and reports | Submit unpaid, unconfirmed request; synthetic practitioners only | Verify credentials and payment-confirmed booking, retries, cancellation and refunds | Tune availability, buffers and clinic operations | Paid booking requires an approved provider, verified practitioner, and sandbox policy. |
| M4 | Consultation list, completion, seven-day follow-up chat and rebook | Seeded/read-only unless expiry and ownership checks pass | Enable verified paid visit, exact seven-day server cutoff, history and rebooking | Improve scheduling and response operations | Real completion and rebooking require verified clinical operations and a paid-visit policy. |
| M5 | Shop catalog, categories, product facts, cart, vouchers, GST, address and checkout | Browse synthetic catalog; demo order stays unpaid and unfulfilled | Publish approved product/legal data, reserve stock, charge, refund, reconcile and fulfill | Expand products and logistics from pilot evidence | Product facts, inventory, payment terms, and fulfillment owners require client approval. |
| M6 | Order status timeline and GST invoice | Show status only when it reflects stored demo data | Provide real tracking and invoice evidence for pilot orders | Extend carrier, returns and reporting coverage | Real tracking and tax invoices require actual carriers, order data, and approved tax details. |
| M7 | Profile snapshot, program progress, private health vault and deletion | Use synthetic records; verify private storage and owner paths for shown screens | Obtain approved consent/privacy terms; operate records and deletion for real accounts | Audit retention, erasure and access operations | Real health data and retention need approved consent, policy, and qualified review. |
| C1 | Program chat, meal photos, charts, nutritionist assignment and expiry | Demonstrate seeded history; enable writes only where entitlement/RLS is verified | Paid entitlement, assigned nutritionist, private files, push and server-enforced expiry | Expand progression and content delivery | Real program writes require paid entitlement, assigned staff, and approved content. |
| C2 | Practitioner auth, calendar, patients, clinical history, prescriptions and split inbox | Show synthetic queue and supported workflow only | Operate approved practitioners with verified credentials and access boundaries | Scale staffing, schedules and clinical reporting | Real clinical work requires verified practitioner identities and accountable operations. |
| A1 | Admin verification, catalog/program CRUD, inventory, banners and deep links | Use synthetic records; no real fulfillment or financial action | Operate verification, approved content, refunds and support ownership | Add broader controls and reporting from pilot needs | Operational actions need approved content and named support/refund owners. |
| A2 | Razorpay/Cashfree gateway and payment/webhook audit | Gateway calls disabled; distinguish unpaid from captured/refunded | Razorpay selected and Healthoraa-owned sandbox account reported ready; verify signed webhooks, exact-once fulfillment, refunds and reconciliation | Cohort rollout, monitoring, rollback and incident response | Sandbox proof, payment/reservation policy, operators and live-use approval remain open. |
| D1 | Roles, RLS, chat boundaries, secure storage, deletion and push-token privacy | Review database enforcement for paths shown; use demo data only | Qualified privacy/security/clinical/product review before real users | Repeat audits, incident drills and access reviews | A code review cannot replace qualified legal, clinical, and privacy approval for real users. |
| D2 | Private 60-second signed URLs, deletion and data minimization | Verify synthetic records and short-lived links | Apply approved retention/consent and support procedures | Audit retention, erasure and access operations | Retention and real-data deletion behavior need an approved policy and responsible operator. |
| D3 | Primary/standby replication, PITR and encrypted Cloudflare R2 copies | Document as not deployed; never imply HA from code | Approve provider setup, ownership, cost and restore objectives | Configure, monitor and prove failover, restore and R2 recovery drills | Provider accounts, cost, and recovery objectives are client-owned. |
| D4 | DPDPA, NMC, dietetics, FSSAI, store and account requirements | Mark unresolved legal/business data; use synthetic examples | Obtain market-specific review and client-provided entity, license, grievance, refund and practitioner data | Maintain evidence and re-review as markets/products change | The market, entity, credentials, labels, and legal terms require client and qualified-advisor confirmation. |
| R1 | Authenticated error, retry, idempotency and observable operations | Show loading/error/empty states; no fake success | Prove webhook, retry, duplicate, delayed/out-of-order and reconciliation behavior | Load, incident, capacity and rollback exercises | Provider lifecycle and production alerts need the selected sandbox, named operators, and service objectives. |

Recorded client requests also require enough program detail to choose without calling first; a clear “Book Now”/enroll action; a contact route; one client-provided 2–3 minute program video; approved weight-management awareness and Healthoraa USP; and a client decision on whether to mention a dermatologist. Do not invent claims, testimonials, prices, credentials, or suitability advice.

### Client inputs and release approvals

| Input / approval | Required before | Current handling |
|---|---|---|
| Confirm agreement status, milestone acceptance and whether next work is M2/M3/M4 or an optional retainer | Client acceptance or commercial quote | Signature and milestone clearance are unverified; do not contact the client on the user’s behalf |
| Gateway choice and Healthoraa-owned provider account | Any sandbox/live gateway setup | Razorpay and Healthoraa-owned sandbox account reported ready by the user on 2026-11-26; local sandbox credentials and written operating policy are still missing; payment remains disabled |
| Brand guide, Figma source, approved logos, photos and product assets | Final visual/content approval and store submission | Keep Aura Dark / Manrope; label demo/sample imagery; do not present generated placeholders as real |
| Program names, prices, duration, inclusions, approved claims, CTA/contact route and video files | Client-facing program journey | Build only the structure; mark missing values as demo content until supplied |
| Practitioner identity, qualification, registration and status | Any real clinical workflow | Use synthetic records in demo; verify before activation |
| Product ingredients, nutritional facts, batch/expiry, manufacturer, country of origin and FSSAI data | Real storefront/fulfillment | Do not claim compliance from empty/sample fields |
| Privacy/consent, grievance contact, return/refund terms, emergency disclaimer, business/entity/store accounts | Real-user pilot and app-store submission | Require client input and qualified review; this plan is not legal advice or approval |
| Supabase, Cloudflare, Apple, Google and gateway accounts plus backup/recovery objectives | Deployment, store submission and HA proof | Client-owned; no production credential or infrastructure changes in this task |

### Excluded from Phase 1

- Live Razorpay orders, captures, refunds, or real customer charges.
- Claims that a booking is confirmed before server-side payment verification.
- Production patient data or real clinical activity in a demo account.
- The full breadth of future program, retention, operations, and scale features in the PRD.

## Delivery sequence

| Step | Work package | Owner role | Exit evidence |
|---|---|---|---|
| 0 | Reconcile signed scope, client requests, role journeys and deferred items | Product lead + client contact | Approved script/content/input list; no unapproved scope or claim |
| 1 | Close PR #3 payment, security, idempotency and UI defects | App + Supabase engineer + reviewer | Complete: PR #3 merged as `52086dd`; build, clean reset/type generation, 31 E2E checks and Luna reviews passed |
| 2 | Complete the client-facing program discovery/detail/video path | Product + app engineers | Structure and synthetic rehearsal merged in PR #8; client copy, video, price, CTA, and contact route remain pending |
| 3 | Make local demo data and startup/reset repeatable; close three role journeys | Full-stack engineer | The current clean reset/type-generation and 38-test E2E run pass; the manual three-role walkthrough and native patient runtime remain open |
| 4 | Polish shown screens to the existing brand and accessibility bar | Product designer + app engineers | Four-surface rendered review, responsive/accessibility evidence, no high-impact UI defect |
| 5 | Rehearse security, data isolation, errors and recovery on a fresh local database | Supabase engineer + independent reviewer | Reset/type/build and role/RLS checks pass; no unresolved high-severity issue |
| 6 | Rehearse the client demo and prepare the acceptance handout | Demo owner | Evidence mapped to M1–M4, known limitations, commercial terminology and open inputs |
| 7 | Approve payment/reservation policy and operational owners | Client/business owner + engineering | Written gateway, expiry, retry, duplicate/delayed webhook, cancellation/refund, reconciliation and support policy |
| 8 | Implement sandbox payment and controlled pilot readiness | Payments engineer + operations | Webhook/refund/reconciliation evidence; live mode stays off until written approval |
| 9 | Prove broader-launch operations | Platform + security + operations | Backup/restore, failover, R2 recovery, monitoring, incident, capacity and rollback evidence |

Step 1 is complete. Step 2 has the catalog/detail structure and synthetic rehearsal merged, but remains open until client-owned copy, video, price, CTA, and contact inputs are resolved. Step 3's earlier reset and E2E checks passed twice, and the current clean reset/type-generation and 38-test suite also pass; the step remains open until the manual three-role walkthrough—including the native patient runtime—passes without manual SQL edits. Client-facing claims, payment enablement, real-user data, app-store releases and production infrastructure cannot be completed without the listed owner approvals and account access.

## Phase 1 work detail and acceptance

### A. Scope and demo environment

- Map every PRD capability to `Phase 1`, `Phase 2`, or `Later`, including one sentence on why deferred work is not needed for the demo.
- Write the presenter script with setup, test accounts, exact screens, expected outcomes, and reset instructions.
- Seed synthetic patient/practitioner/catalog/order data. Mark demo records in the interface; never copy real patient data into the demo.
- Document prerequisites, env vars, startup, database reset/seed, and troubleshooting. Keep secrets out of the repo.
- Ensure a backend/network failure produces a visible error. Do not silently replace a failed live request with fake success data.

**Acceptance:** a clean local checkout can be reset and started from documented commands; three role accounts complete their journeys without a developer editing the database by hand; a second rehearsal starts from the same known state.

### B. Payments and booking truthfulness

- Default Razorpay to disabled in the client and in `create-razorpay-order`; require an explicit environment switch to enable it later.
- In Phase 1, show a clear disabled/demo state. A missing key or disabled flag must never invoke Razorpay or create a gateway order.
- Rename web prototype copy that claims to open Razorpay. Keep pending/unpaid state explicit; never use “paid,” “confirmed,” or a payment success screen for a mock checkout.
- Verify that the server remains authoritative for amounts, patient ownership, payment verification, and fulfillment.
- Cap active pending shop reservations per patient and retain idempotent checkout keys so fresh-key retries cannot reserve inventory without limit.
- For a captured payment whose booking or stock reservation has expired, request a full refund with a provider idempotency key; record created, processed, and failed refund webhooks; retry temporary API failures through webhook delivery; and keep a manual review path when the automatic request fails permanently.
- Configure the Razorpay webhook endpoint for `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`, and `refund.failed` before the sandbox proof.
- Before Phase 2 live mode, prove stale-order handling, retries, duplicate/delayed/out-of-order payment and refund webhooks, cancellation, customer messaging, daily reconciliation, and an accountable operator in the selected gateway's sandbox.
- Before any Phase 2 real-user pilot, get qualified review of privacy/consent, telemedicine, prescription, and product-label obligations for the target market.

**Acceptance:** with all payment flags unset, a booking/order cannot create a Razorpay order; no checkout screen claims payment happened; a user can distinguish “held locally,” “awaiting payment,” and “confirmed.”

### C. UI quality and accessibility

- Review the exact screens in the demo, not every unshown page, first. Establish a coherent hierarchy, readable contrast, clear primary actions, consistent status labels, and deliberate empty/loading/error states.
- Replace placeholders only with approved practitioner/product/brand assets. Do not invent clinical credentials, product photography, testimonials, or outcomes.
- Reduce repeated generic cards, pills, and unnecessary monospace labels. Give program and video details clear titles, value, next action, and status.
- Verify Manrope/font loading on mobile and web. Check narrow and wide layouts, keyboard navigation, screen-reader names, focus visibility, and touch targets (44pt minimum on mobile).
- Validate contrast to WCAG AA for text and controls in the screens shown; status must not rely on color alone.

**Acceptance:** no demo screen has clipped text, fake/missing imagery presented as real, dead primary actions, or unresolved high-impact readability/accessibility issues. The reviewer records evidence and scores each shown interface 2/2 on the rubric below.

### D. Journey, data, and security verification

- Run customer, practitioner, and admin walkthroughs against a fresh local database and demo identities.
- Verify role/ownership isolation in PostgreSQL RLS, not only through hidden navigation. Check patient records, practitioner assignments, admin-only reconciliation data, and storage access used by the demo.
- Verify signed clinical-file URLs are short-lived and private; verify deletion/anonymization and push-token ownership for the applicable paths.
- Review all current migrations on a fresh reset, regenerate DB types, and type-check/build all apps and Edge Functions.
- Record initial-load evidence and agree a demo/pilot bundle budget. The current practitioner build's largest JavaScript chunk is 433.21 kB (122.50 kB gzip), below Vite's 500 kB warning threshold; the admin build emits 698.05 kB initial JavaScript and a 378.99 kB chart chunk. Measure the actual first route and defer/split heavy modules if it misses the agreed budget.
- Add automated smoke coverage for the three client journeys and the payment-disabled boundary; keep a manual fallback in the demo notes.
- Confirm errors are actionable and observable; retries do not duplicate bookings, orders, or fulfillment.

**Acceptance:** fresh reset and type generation succeed; app/Edge Function checks pass; all three journeys pass twice; no unresolved critical/high security finding exists in a shown path; a failed request is visible and cannot look like success.

## 10/10 client-ready scorecard

Score each dimension 0, 1, or 2 using the evidence named below. **The client-ready bar is 10/10, with no critical/high defect.** If any dimension is below 2, keep the demo labeled as work in progress and close that gap before calling Phase 1 complete.

### Current engineering evidence score: 8/10

This is a provisional engineering-readiness assessment, not client approval, and is separate from the UI-specific rating. Earlier clean-reset rehearsals passed twice; the current candidate passes a clean reset, type generation, full build and 38/38 E2E tests. The last full-surface UI review scored the web portals 6.3/10 overall. A later representative review scored 6.8/10 across the screens it rendered; this is not a refreshed full-portal score. The focused admin overview review after PR #26 scored 8.5/10. A presenter-led walkthrough, keyboard/screen-reader review, native device review, and client approval of copy/assets are still outstanding.

| Dimension | Current | Evidence and remaining gap |
|---|---:|---|
| Scope and honesty | 2/2 | Payment stays disabled, unpaid bookings remain unconfirmed, and synthetic data is labeled in demo mode. Client-owned content and assets still need approval. |
| Complete journeys | 1/2 | The current 38-test lifecycle/regression/security suite passes after a clean reset; earlier clean-reset rehearsals also passed twice. The presenter has not completed the three-role runbook unaided. |
| UI and accessibility | 1/2 | Last full-surface GPT-6 Luna UI review scored the web portals 6.3/10; a newer representative review averaged 6.8/10 for the screens it covered. The focused admin overview review scored 8.5/10. Keyboard, screen-reader, native-device, and client visual-direction evidence remain open. |
| Reliability and data | 2/2 | The current candidate passes clean reset, type generation, build and 38-test E2E verification, with post-run E2E data cleanup verified. |
| Security and operations | 2/2 | RLS and private-file boundaries are exercised; payment is fail-closed. Production operator, restore, and live-gateway evidence are explicitly deferred. |

| Dimension | 2 points requires | Evidence |
|---|---|---|
| Scope and honesty | Every shown capability is real or labeled demo/prototype; no false payment/clinical claim | Approved script and screen-by-screen claim check |
| Complete journeys | Patient, practitioner, and admin stories finish without developer intervention | Two clean rehearsals and smoke results |
| UI and accessibility | Approved visual direction, readable and responsive screens, accessible actions/states | Per-interface review and accessibility checklist |
| Reliability and data | Fresh reset works; loading/error/retry states are truthful; writes are idempotent | Reset/type/build results and journey evidence |
| Security and operations | Role/RLS boundaries hold; files stay private; payment is fail-closed; limitations are owned | Security review and environment/config review |

## Client demo go/no-go gate

Show the current work to the client only when all are true:

- The scorecard is 10/10 and no critical/high issue remains in the demo paths.
- The script succeeds twice from a clean reset, using synthetic demo accounts and records.
- The demo environment has no live payment credentials and both client/server payment switches default off.
- All three role journeys work, and data isolation has been checked at the database policy layer.
- Approved assets/copy are used, or the client has explicitly agreed that current demo assets are acceptable.
- The presenter can run the demo unaided and has a short known-limitations/Phase 2 handout.

## PR, review and merge protocol

- Keep each change set scoped to one independently verifiable outcome. Phase 1 uses the existing customer-app PR for the app/security/payment boundary, then a separate program-discovery PR if it does not fit cleanly in that review. Phases 2 and 3 also use small PRs for payment lifecycle, operational readiness, and scale work.
- Before each PR: inspect the current diff, run the affected type/build/database/function checks, run the relevant existing journey coverage, and remove unrelated files. Never include files from the protected original checkout or local audit logs.
- For each PR: open it against current `main`, wait for required checks, request an independent review, verify every finding against current code, fix real issues, and reply with the commit that contains the fix. Merge only after the branch is current, no conflict exists, required checks pass, and no unresolved critical/high finding remains.
- After merge: verify the merged commit on `main`, record the PR, merge SHA and evidence in the local decision log, then start the next phase. If repository permissions, stale base, conflict, or an external approval blocks a step, keep the goal active and report the specific blocker; do not claim that phase passed.
- These engineering PRs do not imply client milestone clearance, store submission, production deployment, or live payment authorization.

## Phase 2: paid-pilot readiness

1. Get written client confirmation of gateway, payment and reservation policy, stale-order handling, refund owner, reconciliation owner, customer support path and pilot metrics.
2. Implement and verify the chosen provider’s sandbox flow for captured, failed, duplicate, delayed and out-of-order events; exact-once fulfillment; ownership/amount validation; retries; and refund recovery.
3. Provide booking cancellation and inventory-release flows that restore state exactly once. An expired reservation cannot be paid or fulfilled unless it is reserved again.
4. Operate sandbox reconciliation and alerting. Keep live keys disabled until a named operator owns the refund queue and the late-capture runbook has been rehearsed.
5. Enable a limited live cohort only after written business approval, Healthoraa-owned accounts, operational runbooks, support coverage, qualified privacy/clinical/product compliance review and rollback readiness.
6. Track booking/order completion, abandonment, payment failures, refunds, late captures and support contacts; review weekly before widening access.

**Current evidence:** Razorpay and a Healthoraa-owned sandbox account were confirmed by the user on 2026-11-26. The local E2E suite passes 38/38, including failed-payment diagnostics, repeat-safe booking/stock cancellation, late-capture handling, and the HTTPS tracking URL database constraint. It exercises unsigned Razorpay-shaped events only against local Supabase; it is not evidence of a real sandbox transaction or signed provider webhook. Local sandbox credentials, payment/reservation policy, named refund/reconciliation/support owners, and compliance review are still required. Keep both payment switches disabled.

## Phase 3: broader-launch readiness

- Complete deferred PRD workflows using Phase 2 evidence: program progression, client documents, order tracking, practitioner operations and retention.
- Configure and prove the agreement’s backup/restore, standby/failover and off-site file-copy expectations. Source configuration is not evidence that a secondary database or Cloudflare R2 vault exists or works.
- Establish alert ownership, incident response, capacity limits, support coverage, accessibility checks and rollback criteria before wider rollout.
- Release by cohort with measurable quality and support gates; retain an auditable record of approvals and recovery drills.

**Current code-side progress:** The current branch adds an HTTPS carrier tracking URL to the admin shipment update flow and a patient-facing tracking action. This is a link handoff only; it does not establish carrier integration, operational ownership, backup/restore, failover or broader-launch readiness.

### Phase completion gates

| Engineering phase | Complete only when | Explicitly remains outside agent-controlled completion |
|---|---|---|
| 1 — Demo readiness | Phase 1 scorecard is 10/10; clean local reset and all three role journeys pass twice; rendered UI/accessibility review passes; payment remains fail-closed; all phase PRs reviewed and merged | Client review/acceptance, milestone payment clearance, approved content and production deployment |
| 2 — Paid-pilot readiness | Chosen provider passes sandbox lifecycle/recovery coverage; named operators accept runbooks; privacy/clinical/product review and pilot approval are recorded; PRs reviewed and merged | Turning on live credentials or charging customers without explicit written client/business approval |
| 3 — Broader-launch readiness | Deferred workflows and operational controls pass; restore/failover/capacity evidence is recorded; rollout and rollback gates pass; PRs reviewed and merged | Store account actions, provider-account changes, production rollout, or ongoing paid support without the account owner’s approval |

## Risks, dependencies, and default decisions

| Item | Risk or dependency | Default / mitigation |
|---|---|---|
| Demo scope | Showing every interface may make the walkthrough too broad | Default to the three journeys above; shorten the script with the client if meeting time is limited |
| Product imagery | Unapproved or synthetic-looking imagery reduces trust | Ask the client for approved photos, logos, and product assets; keep honest neutral placeholders only if clearly marked |
| Payment state | A gateway order can remain payable after local expiry | Keep live payments off in Phase 1; approve and operate a stale-order/refund policy before Phase 2 |
| Demo data | Real health data in a demo creates privacy risk | Seed synthetic records and isolated test accounts only |
| Database state | A migration may work against an existing DB but fail from scratch | Require clean `supabase db reset`, type generation, and fresh rehearsal before client review |
| Portal bundle size | The admin portal's 698.76 kB initial JavaScript chunk may affect first load | Practitioner largest chunk is 433.02 kB (122.49 kB gzip); admin initial chunk is 698.76 kB (202.83 kB gzip) and chart chunk 378.99 kB (108.51 kB gzip). Measure both demo routes, agree budgets, and defer/split only where needed |
| Clinical claims | Demo copy could be interpreted as medical advice or a guaranteed outcome | Use reviewed, factual copy; label example content; keep clinical decisions with licensed practitioners |

## Commands and evidence to capture

Run from the repository root when the local Supabase stack is available:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm db:types
pnpm --filter mobile exec tsc --noEmit
pnpm --filter patient-portal build
pnpm --filter doctor-portal build
pnpm --filter admin-portal exec tsc --noEmit
pnpm test:e2e
```

Also run `deno check` for changed Edge Functions and manually verify mobile/web visual states at narrow and wide sizes. Record commands, environment (without secrets), results, screenshots, and outstanding issues in the client-demo handout. Do not claim the database or end-to-end gates passed until those commands have actually succeeded.

## Decision options for the client review

The implementation default is **Option A** for both items; neither blocks Phase 1 work.

| Decision | A — Recommended default | B — Alternative | Trade-off |
|---|---|---|---|
| Phase 1 payments | No gateway checkout; keep all payment paths off | Razorpay sandbox-only demonstration | Sandbox proves more UI flow but adds gateway setup and can distract from validating the product journeys |
| Demo breadth | Show all four current interfaces through three role journeys | Show patient-facing flows only | Narrower walkthrough is shorter, but postpones feedback on practitioner/admin workflows |

The master product requirements remain in [PRD.md](PRD.md); this plan defines delivery order and release evidence.
