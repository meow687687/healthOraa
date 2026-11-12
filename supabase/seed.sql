-- 1. Dev personas for Supabase Auth sign-in. The shared dev password is HealthOraa@2026.
-- Emails match the one-click Sign in pills in each portal's login card.
-- Rows are complete enough for GoTrue to read (aud, role, instance_id, identity row).
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('00000000-0000-4000-8000-00000000ad31', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@healthoraa.com', crypt('HealthOraa@2026', gen_salt('bf')), NOW(),
   '{"provider": "email", "providers": ["email"]}', '{"full_name": "Demo Admin"}', NOW(), NOW(), '', '', '', ''),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'doctor@healthoraa.com', crypt('HealthOraa@2026', gen_salt('bf')), NOW(),
   '{"provider": "email", "providers": ["email"]}', '{"full_name": "Dr. Arishta Sharma"}', NOW(), NOW(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'patient@healthoraa.com', crypt('HealthOraa@2026', gen_salt('bf')), NOW(),
   '{"provider": "email", "providers": ["email"]}', '{"full_name": "Priya Mehta"}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO UPDATE SET
  instance_id = EXCLUDED.instance_id,
  aud = EXCLUDED.aud,
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  confirmation_token = EXCLUDED.confirmation_token,
  recovery_token = EXCLUDED.recovery_token,
  email_change_token_new = EXCLUDED.email_change_token_new,
  email_change = EXCLUDED.email_change,
  created_at = COALESCE(auth.users.created_at, EXCLUDED.created_at),
  updated_at = NOW();

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.id::text, NOW(), NOW(), NOW()
FROM auth.users u
WHERE u.id IN ('00000000-0000-4000-8000-00000000ad31',
               '11111111-1111-1111-1111-111111111111',
               '22222222-2222-2222-2222-222222222222')
ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO public.profiles (id, role, full_name, phone)
VALUES
  ('00000000-0000-4000-8000-00000000ad31', 'admin', 'Demo Admin', NULL),
  ('11111111-1111-1111-1111-111111111111', 'practitioner', 'Dr. Arishta Sharma', '9876543210'),
  ('22222222-2222-2222-2222-222222222222', 'patient', 'Priya Mehta', '9123456780')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.practitioner_details (id, qualification, registration_number, consultation_fee_inr)
VALUES ('11111111-1111-1111-1111-111111111111', 'MBBS, Dermatology', 'NMC-DEMO-001', 799.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert sample nutrition programs
INSERT INTO public.programs (title, category, description, duration_days, price_inr, is_active)
VALUES
  ('60-Day PCOD/PCOS Reset', 'pcod_pcos', 'Hormonal rebalancing and insulin-resistance management via anti-inflammatory dietary plans.', 60, 4999.00, TRUE),
  ('Metabolic Weight Management', 'weight_management', 'Customized calorie-deficit macro plans with weekly nutritionist check-ins.', 60, 3999.00, TRUE),
  ('Clinical Dermato-Nutrition', 'dermato_nutrition', 'Targeted gut-skin axis nutrition protocol for chronic acne and barrier repair.', 60, 5499.00, TRUE)
ON CONFLICT DO NOTHING;

-- 2b. Mock active program enrolments and day 18/day 42 progress logs.
-- Day 1 is the start date, so 17 days 12 hours ago is Day 18 and 41 days 12 hours ago is Day 42.
INSERT INTO public.program_enrolments (id, program_id, patient_id, dietitian_id, started_at)
VALUES
  ('abababab-0000-4000-8000-000000000001',
    (SELECT id FROM public.programs WHERE title = '60-Day PCOD/PCOS Reset' LIMIT 1),
    '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '17 days 12 hours'),
  ('abababab-0000-4000-8000-000000000002',
    (SELECT id FROM public.programs WHERE title = 'Metabolic Weight Management' LIMIT 1),
    '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '41 days 12 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.program_progress_logs (enrolment_id, day_number, meals_logged, water_intake_ml, dietitian_feedback)
VALUES
  ('abababab-0000-4000-8000-000000000001', 18, '["breakfast"]'::JSONB, 1800,
    'Day 18: water is on track. Add lunch and dinner to the log, and keep the evening snack to nuts or curd.'),
  ('abababab-0000-4000-8000-000000000002', 42, '[]'::JSONB, 2000, NULL)
ON CONFLICT (enrolment_id, day_number) DO NOTHING;

-- 2c. Bookable slots for the doctor: 30-minute slots from 10:00-13:00 and 17:00-20:00 IST,
-- on weekdays, for the next two weeks. Written directly because the generator needs a signed-in practitioner.
INSERT INTO public.consultation_slots (practitioner_id, start_time, end_time)
SELECT '11111111-1111-1111-1111-111111111111',
  ((CURRENT_DATE + d.day_offset)::TIMESTAMP + b.slot_time::TIME) AT TIME ZONE 'Asia/Kolkata',
  ((CURRENT_DATE + d.day_offset)::TIMESTAMP + b.slot_time::TIME + INTERVAL '30 minutes') AT TIME ZONE 'Asia/Kolkata'
FROM generate_series(1, 14) AS d(day_offset)
CROSS JOIN (
  SELECT t AS slot_time FROM generate_series(TIMESTAMP '2000-01-01 10:00', TIMESTAMP '2000-01-01 12:30', INTERVAL '30 minutes') AS t
  UNION ALL
  SELECT t FROM generate_series(TIMESTAMP '2000-01-01 17:00', TIMESTAMP '2000-01-01 19:30', INTERVAL '30 minutes') AS t
) AS b
WHERE EXTRACT(ISODOW FROM CURRENT_DATE + d.day_offset) BETWEEN 1 AND 5
ON CONFLICT (practitioner_id, start_time) DO NOTHING;

-- 2d. A completed consultation with a signed prescription, so the patient's history and Rx preview have real data.
INSERT INTO public.consultations (id, patient_id, doctor_id, slot_start, slot_end, status, chief_complaint, booking_status, amount_inr, created_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days' + INTERVAL '30 minutes', 'completed',
    'Painful cystic acne on the jaw and chin; irregular cycles for about a year', 'confirmed', 799.00, NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prescriptions (id, consultation_id, doctor_id, patient_id, diagnosis, clinical_notes, followup_days, created_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000001',
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
    'PCOD with hormonal acne, Grade I', 'Metformin and topical adapalene started. Review in two weeks.', 14, NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prescription_medicines (prescription_id, name, dosage, frequency, duration_days, instructions)
VALUES
  ('dddddddd-0000-4000-8000-000000000002', 'Metformin 500mg', '1 tablet', 'Twice daily after meals', 90, 'Take with food'),
  ('dddddddd-0000-4000-8000-000000000002', 'Adapalene 0.1% gel', 'Pea-sized amount', 'Once daily at night', 60, 'Apply after moisturiser');

-- 3. Insert sample store orders for the mock customer
INSERT INTO public.orders (id, customer_id, total_amount_inr, status, shipping_address, tracking_number, created_at)
VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 1299.00, 'shipped', '14 Lakeview Road, Bengaluru, Karnataka 560071', 'DTDC-IN-884210937', NOW() - INTERVAL '2 days'),
  ('aaaaaaa2-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 649.50, 'pending', '14 Lakeview Road, Bengaluru, Karnataka 560071', NULL, NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert mock promotional banners for the patient app carousel
-- Program target is resolved by title because program UUIDs are generated per reset.
INSERT INTO public.app_banners (id, title, image_url, target_type, target_id, display_order, is_active)
VALUES
  ('bbbbbbb1-0000-4000-8000-000000000001', '60-Day PCOD Reset: Launch Offer', 'https://images.example.com/banners/pcod-reset.jpg', 'program',
    (SELECT id::text FROM public.programs WHERE title = '60-Day PCOD/PCOS Reset' LIMIT 1), 0, TRUE),
  ('bbbbbbb2-0000-4000-8000-000000000002', 'Book a Certified Doctor Consultation', 'https://images.example.com/banners/doctor-consult.jpg', 'doctor',
    '11111111-1111-1111-1111-111111111111', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Mock consultation so one payment can reference a doctor booking
INSERT INTO public.consultations (id, patient_id, doctor_id, slot_start, slot_end, status, followup_expires_at)
VALUES
  ('cccccccc-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
    NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '30 minutes', 'cancelled', NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Mock payment transactions covering captured, failed and refunded states
INSERT INTO public.payment_transactions
  (id, order_id, consultation_id, gateway, gateway_payment_id, gateway_order_id, amount_inr, currency, status, error_code, error_description, created_at)
VALUES
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000001', NULL, 'razorpay',
    'pay_NkQ7mCap1Xw2Lr', 'order_NkQ7kT0Yb3Ld9s', 1299.00, 'INR', 'captured', NULL, NULL,
    NOW() - INTERVAL '2 days'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaa2-0000-4000-8000-000000000002', NULL, 'razorpay',
    'pay_NkQ9pZr4Vh8Tq1', 'order_NkQ9oE7Ws2Gc4m', 649.50, 'INR', 'failed', 'BAD_REQUEST_ERROR',
    'Payment failed: the card was declined by the issuing bank.', NOW() - INTERVAL '4 hours'),
  ('dddddddd-0000-4000-8000-000000000003', NULL, 'cccccccc-0000-4000-8000-000000000001', 'razorpay',
    'pay_NkP3tQw6Ka2Jx8', 'order_NkP3sB1Dc5Mf7n', 799.00, 'INR', 'refunded', NULL, NULL,
    NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- 7. Wellness store catalog. Low stock (<5) and out-of-stock rows exercise the admin alerts.
INSERT INTO public.products (id, sku, title, category, description, price_inr, stock_count, is_active)
VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'HX-ASH-KSM66', 'Ashwagandha KSM-66 Balance', 'ayurvedic',
    'Full-spectrum KSM-66 root extract for stress resilience and sleep quality. 60 capsules.', 899.00, 42, TRUE),
  ('eeeeeeee-0000-4000-8000-000000000002', 'HX-OMG-3T', 'Omega-3 Triple Strength EPA/DHA', 'supplements',
    'Triple-strength fish oil concentrate with EPA and DHA for heart and cognitive health. 60 softgels.', 1299.00, 18, TRUE),
  ('eeeeeeee-0000-4000-8000-000000000003', 'HX-CER-BAR', 'Ceramide Barrier Restoring Cream', 'skincare',
    'Ceramide and niacinamide moisturiser for dry, reactive skin. 50 g.', 749.00, 3, TRUE),
  ('eeeeeeee-0000-4000-8000-000000000004', 'HX-SCALE-BT', 'Smart Bluetooth Body Composition Scale', 'equipment',
    'Bluetooth scale measuring weight, body fat, muscle mass and hydration. Syncs with the Healthoraa app.', 2499.00, 0, FALSE)
ON CONFLICT (sku) DO NOTHING;

-- 8. DPDPA 2023 data subject requests for the mock patient. One per lifecycle state.
INSERT INTO public.compliance_requests (id, user_id, request_type, status, notes, resolved_at, created_at)
VALUES
  ('ffffffff-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'data_export', 'completed',
    'Data packet generated and delivered to the data principal.', NOW(), NOW() - INTERVAL '6 days'),
  ('ffffffff-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 'erasure_request', 'pending',
    'User requested complete removal of clinical history under DPDPA section 12.', NULL, NOW() - INTERVAL '1 day'),
  ('ffffffff-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222222', 'consent_withdrawal', 'processing',
    'Withdrawal of consent for marketing communications. Propagating to the notification service.', NULL, NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;

-- 9. Health Locker documents and associated biomarker results for the mock patient.
INSERT INTO public.patient_documents
    (id, patient_id, title, category, document_date, file_path, extracted_metadata)
VALUES
  ('abababab-0000-4000-8000-000000000011', '22222222-2222-2222-2222-222222222222',
    'Comprehensive Metabolic Panel & HbA1c', 'blood_panel', DATE '2026-10-15',
    '22222222-2222-2222-2222-222222222222/health-locker/metabolic-panel-2026-10-15.pdf',
    '{"hba1c": 6.1, "fasting_glucose": 104, "tsh": 3.8, "ldl_cholesterol": 128}'::JSONB),
  ('abababab-0000-4000-8000-000000000012', '22222222-2222-2222-2222-222222222222',
    'Pelvic Ultrasound Report', 'imaging_radiology', DATE '2026-09-20',
    '22222222-2222-2222-2222-222222222222/health-locker/pelvic-ultrasound-2026-09-20.pdf', '{}'::JSONB),
  ('abababab-0000-4000-8000-000000000013', '22222222-2222-2222-2222-222222222222',
    'Signed Dermatology Prescription', 'prescription', DATE '2026-11-02',
    '22222222-2222-2222-2222-222222222222/health-locker/dermatology-prescription-2026-11-02.pdf', '{}'::JSONB)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.patient_biomarkers
    (id, patient_id, marker_name, marker_value, unit, reference_range, tested_at, document_id)
VALUES
  ('abababab-0000-4000-8000-000000000021', '22222222-2222-2222-2222-222222222222',
    'hba1c', 6.1, '%', '4.0 - 5.6', DATE '2026-10-15', 'abababab-0000-4000-8000-000000000011'),
  ('abababab-0000-4000-8000-000000000022', '22222222-2222-2222-2222-222222222222',
    'fasting_blood_sugar', 104, 'mg/dL', '70 - 99', DATE '2026-10-15', 'abababab-0000-4000-8000-000000000011'),
  ('abababab-0000-4000-8000-000000000023', '22222222-2222-2222-2222-222222222222',
    'tsh', 3.8, 'uIU/mL', '0.4 - 4.0', DATE '2026-10-15', 'abababab-0000-4000-8000-000000000011'),
  ('abababab-0000-4000-8000-000000000024', '22222222-2222-2222-2222-222222222222',
    'ldl_cholesterol', 128, 'mg/dL', '< 100', DATE '2026-10-15', 'abababab-0000-4000-8000-000000000011')
ON CONFLICT (id) DO NOTHING;
