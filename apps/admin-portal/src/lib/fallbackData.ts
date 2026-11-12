import type { Product } from "@healthoraa/types";

export { withFallback } from "@healthoraa/ui";

import type { ComplianceRequestWithUser } from "../hooks/useCompliance";

// Client-side fallback datasets. Used by the query hooks when Supabase is unreachable
// or returns no rows, so the prototype never renders an empty or broken view.
// Mock IDs are never sent to the database by the list views.

export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "fa110000-0000-4000-8000-000000000001",
    sku: "HX-ASH-KSM66",
    title: "Ashwagandha KSM-66 Balance",
    category: "ayurvedic",
    description: "Full-spectrum KSM-66 root extract for stress resilience and sleep quality. 60 capsules.",
    price_inr: 899,
    stock_count: 42,
    is_active: true,
    created_at: "2026-11-01T09:00:00.000Z",
  },
  {
    id: "fa110000-0000-4000-8000-000000000002",
    sku: "HX-OMG-3T",
    title: "Omega-3 Triple Strength EPA/DHA",
    category: "supplements",
    description: "Triple-strength fish oil concentrate with EPA and DHA for heart and cognitive health. 60 softgels.",
    price_inr: 1299,
    stock_count: 18,
    is_active: true,
    created_at: "2026-11-01T09:05:00.000Z",
  },
  {
    id: "fa110000-0000-4000-8000-000000000003",
    sku: "HX-CER-BAR",
    title: "Ceramide Barrier Restoring Cream",
    category: "skincare",
    description: "Ceramide and niacinamide moisturiser for dry, reactive skin. 50 g.",
    price_inr: 749,
    stock_count: 3,
    is_active: true,
    created_at: "2026-11-01T09:10:00.000Z",
  },
  {
    id: "fa110000-0000-4000-8000-000000000004",
    sku: "HX-SCALE-BT",
    title: "Bluetooth Body Composition Scale",
    category: "equipment",
    description: "Bluetooth scale measuring weight, body fat, muscle mass and hydration. Syncs with the Healthoraa app.",
    price_inr: 2499,
    stock_count: 0,
    is_active: false,
    created_at: "2026-11-01T09:15:00.000Z",
  },
];

const FALLBACK_PATIENT = { full_name: "Priya Mehta", role: "patient" as const };
const FALLBACK_PATIENT_ID = "22222222-2222-2222-2222-222222222222";

export const FALLBACK_COMPLIANCE_REQUESTS: ComplianceRequestWithUser[] = [
  {
    id: "fa220000-0000-4000-8000-000000000001",
    user_id: FALLBACK_PATIENT_ID,
    request_type: "data_export",
    status: "pending",
    notes: null,
    resolved_at: null,
    created_at: "2026-11-05T10:00:00.000Z",
    profiles: FALLBACK_PATIENT,
  },
  {
    id: "fa220000-0000-4000-8000-000000000002",
    user_id: FALLBACK_PATIENT_ID,
    request_type: "erasure_request",
    status: "pending",
    notes: "User requested complete removal of clinical history under DPDPA section 12.",
    resolved_at: null,
    created_at: "2026-11-10T08:30:00.000Z",
    profiles: FALLBACK_PATIENT,
  },
  {
    id: "fa220000-0000-4000-8000-000000000003",
    user_id: FALLBACK_PATIENT_ID,
    request_type: "consent_withdrawal",
    status: "processing",
    notes: "Withdrawal of consent for marketing communications.",
    resolved_at: null,
    created_at: "2026-11-11T06:00:00.000Z",
    profiles: FALLBACK_PATIENT,
  },
];
