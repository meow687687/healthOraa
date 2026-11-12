# PRD.md — Healthoraa Master Product Requirements Document

| Document Version | 1.0.0 (Production Blueprint) |
| :--- | :--- |
| **Target Platforms** | iOS & Android Mobile Apps (Expo / React Native), Doctor Web Portal, Admin Web Portal |
| **Core Architecture** | Supabase Pro Backend (PostgreSQL, Realtime, GoTrue, S3 Storage) + Dual-Database HA Replica |
| **Regulatory Scope** | DPDPA 2023, NMC Telemedicine Practice Guidelines (2020), FSSAI E-Commerce Regulations |

---

## 1. Executive Summary & Product Scope

**Healthoraa** is an enterprise-grade digital health ecosystem bridging specialized clinical nutrition, licensed doctor tele-consultations, and verified wellness e-commerce.

The platform unifies three primary software interfaces powered by a single PostgreSQL backend:
1. **Customer Mobile Application (iOS & Android):** An intuitive mobile application for clients to enroll in structured diet programs, book doctor appointments, track meal photos, chat with assigned practitioners, and order wellness goods.
2. **Doctor & Nutritionist Web Portal:** A specialized browser dashboard for registered medical practitioners (RMPs) and certified clinical nutritionists to manage consultations, upload diet charts and prescriptions, and manage follow-up communications.
3. **Central Operational Admin Portal:** A comprehensive administrative console for founders and clinic operations staff to verify practitioner credentials, manage product catalogs, configure promotional banners, and monitor payments.

---

## 2. User Personas & Access Control Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE AUTH (GoTrue)                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│     CUSTOMER     │      │  PRACTITIONER    │      │  SUPER ADMIN     │
│   (Mobile App)   │      │  (Doctor Portal) │      │  (Admin Portal)  │
├──────────────────┤      ├──────────────────┤      ├──────────────────┤
│• Programs & Shop │      │• 30/45 min slots │      │• Catalog control │
│• Book doctors    │      │• Upload charts   │      │• Verify doctors  │
│• Timed chats     │      │• Prescriptions   │      │• Order dispatch  │
│• Upload records  │      │• Follow-up chat  │      │• Audit & stats   │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

### Role Capabilities & Access Boundaries

| Role Identifier | Client Interface | Permitted Actions & Boundaries |
| :--- | :--- | :--- |
| `customer` | Mobile App (iOS / Android) | • Browse programs, book slots, purchase store items.<br>• View own medical records and uploaded diet plans.<br>• Send messages within active program windows and active 7-day follow-up windows.<br>• Cannot access web portals or view other clients' data. |
| `doctor` | Doctor Web Portal | • Set working hours and consultation fees.<br>• View assigned patient medical histories.<br>• Issue digital prescriptions with NMC registration number.<br>• Access 7-day follow-up chat window post-consultation.<br>• Cannot modify global program pricing or system configurations. |
| `nutritionist` | Doctor Web Portal | • View enrolled clients under nutrition plans.<br>• Upload meal-by-meal PDF diet charts.<br>• Receive meal photos and review client dietary adherence.<br>• Communicate throughout the full active program duration (e.g., 60 days).<br>• Cannot prescribe allopathic medications. |
| `admin` | Admin Web Portal | • Full CRUD on programs, store products, and promotional banners.<br>• Verify and approve doctor credentials and registration certificates.<br>• Update e-commerce order statuses (`pending`, `paid`, `shipped`, `delivered`).<br>• Emergency view-only audit access across all platform entities. |

---

## 3. Customer Mobile Application Specifications

### Primary Navigation Architecture (4 Core Tabs)

```
┌────────────────────────────────────────────────────────┐
│                   HEALTHORAA MOBILE                    │
├────────────┬──────────────┬──────────────┬─────────────┤
│   HOME     │ CONSULTATION │     SHOP     │   PROFILE   │
│   (Tab)    │    (Tab)     │    (Tab)     │    (Tab)    │
└────────────┴──────────────┴──────────────┴─────────────┘
```

#### 1. Home Tab
- **Promotional Banner Carousel:** Configurable dynamic hero cards managed from the Admin Portal. Supports deep-linking to specific health programs, wellness products, or consultation categories.
- **Quick-Access Action Grid:**
  - *Book Doctor Consultation*
  - *My Active Diet Plan*
  - *Wellness Store*
  - *Upload Medical Record*
- **Curated Program Categories (Horizontal & Grid Views):**
  - **Weight Management:** Structured 30/60/90-day metabolic plans.
  - **PCOD / PCOS Clinical Nutrition:** Hormonal balancing and cycle-aligned meal plans.
  - **Dermato-Nutrition:** Anti-inflammatory dietary protocols for acne, eczema, and skin vitality.
  - **Personalized Medical Nutrition:** Customized diet therapy for diabetes, hypertension, and gut health.
- **Featured Practitioners:** Cards displaying verified doctors with star ratings, qualifications, and consultation booking buttons.
- **Best-Selling Wellness Products:** Quick-add cards for vitamins, herbal infusions, and supplements.

#### 2. Consultation Tab
- **Specialty & Filter Header:** Filter by specialty (General Physician, Gynecologist, Clinical Nutritionist, Dermatologist), slot duration (30 min / 45 min), and fee range.
- **Practitioner Directory Cards:**
  - Doctor avatar, full name, credentials (e.g., *MBBS, MD*), and state medical council registration number.
  - Next available slot indicator.
  - Clear consultation fee badge (in INR).
- **Interactive Booking Flow:**
  - Date picker showing next 14 available business days.
  - Time slot chips grouped by *Morning (09:00 - 12:00)*, *Afternoon (13:00 - 16:00)*, and *Evening (17:00 - 20:00)*.
  - Patient intake sheet: Brief description of current symptoms, optional attachment of previous reports.
  - Razorpay checkout integration with instant appointment confirmation.
- **Consultation Management View:**
  - Tabs for *Upcoming*, *Completed*, and *Cancelled* consultations.
  - Direct entry point to the 7-day follow-up chat with a visible countdown timer.

#### 3. Shop Tab
- **Product Catalog Grid:** Displaying product image, brand name, net weight/count, price, and *Add to Cart* action.
- **Category Filter Tabs:** *Nutritional Supplements*, *Herbal Teas & Infusions*, *Organic Superfoods*, *Fitness Accessories*.
- **Detailed Product Screen:**
  - High-resolution product image gallery.
  - Full ingredient transparency, nutritional facts table, and clinical usage guidelines.
  - Statutory FSSAI license badge and manufacturer details.
- **Cart & Checkout Workflow:**
  - Item counter, discount voucher input, order summary (Subtotal, GST, Delivery Fee, Total).
  - Saved delivery address selector with validation.
  - Razorpay payment gateway integration supporting UPI, Debit/Credit Cards, and NetBanking.
  - In-app order tracking timeline (`Order Placed` $\rightarrow$ `Packed` $\rightarrow$ `Shipped` $\rightarrow$ `Delivered`).

#### 4. Profile & Health Vault Tab
- **User Health Snapshot:** Age, gender, height, weight, BMI, primary health objective.
- **My Subscriptions:** Active diet programs with progress indicators (e.g., *Day 24 of 60*).
- **Secure Health Vault:**
  - Repository of all uploaded blood work, imaging reports, and received clinical prescriptions.
  - Direct PDF viewing via secure, short-lived signed URLs.
- **Order History:** Complete e-commerce order receipts with downloadable GST invoices.
- **Account Governance & Compliance:**
  - Privacy policy, terms of service, grievance officer contact.
  - **Mandatory Account Deletion Button:** Fully automated self-service account deletion trigger conforming to Apple App Store and Google Play guidelines.

---

## 4. Strict Entitlement & Server-Enforced Chat Architecture

To maintain medical ethics and avoid doctor fatigue, chat access is governed by strict, automated rules enforced at the database level:

```
                                  CONSULTATION FLOW
                                  ─────────────────
   [Paid 30/45 Min Slot] ───► [Doctor Marks Completed] ───► [7-Day Follow-Up Timer Starts]
                                                                     │
                                               ┌─────────────────────┴─────────────────────┐
                                               ▼                                           ▼
                                      Within 7 Days                               After 7 Days
                                  ─────────────────────                       ─────────────────────
                                  • Text & Report Chat                        • Chat Locked (Read Only)
                                  • Follow-up Guidance                        • "Book Again" Button Appears
                                  • Prescription Queries                      • RLS Rejects New Inserts
```

### A. Personalized Diet Program Chat
- **Eligibility Trigger:** Triggered by purchasing an official nutrition program (e.g., 60-day plan).
- **Active Window:** Valid from enrollment until program expiration (`starts_at` to `expires_at`).
- **Functionality:**
  - Asynchronous messaging between client and assigned nutritionist.
  - Meal photo uploads tagged with metadata (`is_meal_photo = TRUE`) for dietary compliance monitoring.
  - Bi-weekly updated diet plan PDF delivery.
- **Expiration Enforcement:**
  - At expiration, input fields lock automatically.
  - Historical messages and downloaded diet charts remain permanently accessible in read-only mode.

### B. Doctor Tele-Consultation 7-Day Follow-Up Chat
- **Eligibility Trigger:** Activated when a scheduled consultation changes status to `completed`.
- **Active Window:** Exactly **7 calendar days** (`followup_expires_at = slot_end + INTERVAL '7 days'`).
- **Functionality:**
  - Text-based clarification regarding prescribed medications, dosage instructions, and lab test inquiries.
  - PDF/image sharing for local pharmacy availability checks.
- **Expiration Enforcement:**
  - After 7 days, message input is disabled with a notice: *"7-Day Consultation Follow-Up Period Expired. Please book a new consultation for clinical inquiries."*
  - Server-side PostgreSQL RLS policy actively rejects any insert attempts where `NOW() > followup_expires_at`.

---

## 5. Doctor & Nutritionist Web Portal Specifications

- **Authentication & Security:** Supabase Auth with custom claims. Only accounts with `role IN ('doctor', 'nutritionist')` are granted entry.
- **Clinical Calendar & Scheduling:**
  - Weekly view of confirmed consultation slots.
  - One-click configuration for slot durations (30 min vs 45 min) and buffer times.
  - Blockout dates for holidays or clinical absence.
- **Patient Clinical Workspace:**
  - Searchable roster of assigned patients.
  - Complete historical timeline: uploaded lab reports, past prescriptions, and consultation notes.
  - Digital prescription builder: Pre-populated with doctor's credentials and NMC registration number, with input fields for medication name, dosage, frequency, duration, and lifestyle recommendations.
- **Nutritionist Diet Chart Dispatcher:**
  - Direct PDF drag-and-drop upload to the private `diet-charts` S3 bucket.
  - Instant push notification dispatched to the customer's phone upon upload.
  - Meal photo timeline view to review daily patient meal submissions.
- **Segregated Chat Workspace:**
  - Split inbox interface: Left panel separates *Active Diet Programs* from *7-Day Consultation Follow-Ups*.
  - Visual badges indicating days remaining on follow-up chat windows.

---

## 6. Central Operational Admin Portal Specifications

- **Practitioner Credential Verification:**
  - Practitioner onboarding queue displaying uploaded medical degrees and state council registrations.
  - Verification workflow with toggle to approve, suspend, or set custom consultation commission rates.
- **Catalog & Program Management:**
  - Full CRUD interface for health programs (Title, Category, Duration Days, Inclusions, Fee).
  - Rich text editor for program descriptions and target outcomes.
- **E-Commerce Inventory Control:**
  - Product SKU management, stock count tracking, pricing, and category tagging.
  - Order fulfillment workflow: Transition order states (`pending` $\rightarrow$ `paid` $\rightarrow$ `shipped` with tracking ID $\rightarrow$ `delivered`).
- **Promotional Asset Engine:**
  - Upload banner images for mobile app home screen carousels.
  - Deep-link target configuration (e.g., link to `/programs/pcod_pcos` or `/shop/product/123`).
  - Scheduling engine with publish date and unpublish date controls.
- **Financial Audit & Webhook Logs:**
  - Unified view of all Razorpay transactions.
  - Real-time webhook logs for payment reconciliation.

---

## 7. Data Models, Schema & Security Policies

Below is the production database schema and security policies running in Supabase:

```sql
-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('customer', 'doctor', 'nutritionist', 'admin');
CREATE TYPE program_category AS ENUM ('weight_management', 'pcod_pcos', 'dermato_nutrition', 'custom');
CREATE TYPE consultation_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');

-- 3. PROFILES TABLE
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'customer',
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRACTITIONER DETAILS
CREATE TABLE public.practitioner_details (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    qualification TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    bio TEXT,
    consultation_fee_inr NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    slot_duration_minutes INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. NUTRITION PROGRAMS
CREATE TABLE public.programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category program_category NOT NULL,
    description TEXT,
    duration_days INT NOT NULL DEFAULT 60,
    price_inr NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PROGRAM ENROLMENTS
CREATE TABLE public.program_enrolments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    nutritionist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CONSULTATIONS
CREATE TABLE public.consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    status consultation_status NOT NULL DEFAULT 'scheduled',
    followup_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONSULTATION MESSAGES (7-Day Server-Enforced Cutoff)
CREATE TABLE public.consultation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. PROGRAM MESSAGES (Active for Full Purchased Duration)
CREATE TABLE public.program_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrolment_id UUID NOT NULL REFERENCES public.program_enrolments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    attachment_url TEXT,
    is_meal_photo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are readable" ON public.profiles
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Active programs are viewable" ON public.programs
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Participants view own consultations" ON public.consultations
    FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Participants view consultation messages" ON public.consultation_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_messages.consultation_id
            AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
        )
    );

CREATE POLICY "Allow message insertion strictly within 7-day window" ON public.consultation_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.consultations c
            WHERE c.id = consultation_messages.consultation_id
            AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
            AND c.status = 'completed'
            AND NOW() <= c.followup_expires_at
        )
    );

CREATE POLICY "Participants view program messages" ON public.program_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.program_enrolments e
            WHERE e.id = program_messages.enrolment_id
            AND (e.patient_id = auth.uid() OR e.nutritionist_id = auth.uid())
        )
    );

CREATE POLICY "Allow message insertion during active program" ON public.program_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.program_enrolments e
            WHERE e.id = program_messages.enrolment_id
            AND (e.patient_id = auth.uid() OR e.nutritionist_id = auth.uid())
            AND e.is_active = TRUE
            AND NOW() <= e.expires_at
        )
    );
```

---

## 8. High-Availability, Backup & Regulatory Architecture

### Dual-Database High Availability & Cold Disaster Recovery
1. **Primary Operational Instance (Supabase Pro):** Handles application reads, writes, real-time message pub/sub, and primary media storage.
2. **Synchronized Secondary Standby Replica:** Continuously ingests streaming PostgreSQL Write-Ahead Logs (WAL) via hot-standby replication. If the primary instance fails, traffic switches to the standby replica with zero data loss.
3. **Point-in-Time Recovery (PITR):** Transaction logs continuously archived, enabling recovery to any exact minute over the preceding 7 days in the event of accidental data modification.
4. **Encrypted Off-Site Cold Storage (Cloudflare R2):** All medical PDFs and diet charts are asynchronously mirrored to a zero-egress Cloudflare R2 bucket.

### Statutory Compliance Controls
* **Digital Personal Data Protection Act (DPDPA 2023):** Explicit affirmative consent checkboxes for health data processing; strict RLS isolation; short-lived signed URLs for records.
* **NMC Telemedicine Practice Guidelines (2020):** Every digital prescription automatically embeds the doctor's verified full name, qualification, and state/national medical council registration number.
* **FSSAI E-Commerce Regulations:** All wellness products display statutory nutritional panels, expiry dates, batch numbering, and the business's 14-digit FSSAI license number.