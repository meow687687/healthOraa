# Healthoraa

A digital health platform connecting patients with practitioners — built as a Turborepo-managed pnpm monorepo.

## Apps

| App | Stack | Description |
|-----|-------|-------------|
| `apps/mobile` | React Native · Expo Router | Patient-facing mobile app (iOS & Android) |
| `apps/doctor-portal` | React 18 · Vite · Tailwind CSS | Clinical dashboard for practitioners |
| `apps/admin-portal` | React 18 · Vite · Tailwind CSS | Operational dashboard for admins |
| `apps/patient-portal` | React 18 · Vite · Tailwind CSS | Web portal for patients |

## Shared Packages

| Package | Description |
|---------|-------------|
| `packages/types` | Supabase-generated DB types + domain models |
| `packages/validation` | Zod schemas shared across all apps |
| `packages/ui` | Design tokens, shared components, Supabase helpers |

## Tech Stack

- **Backend** — Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **State** — TanStack Query v5
- **Forms** — react-hook-form + Zod
- **Build** — Turborepo + pnpm workspaces
- **Payments** — Razorpay (signature verified server-side via Edge Function)

## Getting Started

**Prerequisites:** Node.js 20+, pnpm 11+, Supabase CLI

```bash
# Install dependencies
pnpm install

# Start Supabase locally
pnpm exec supabase start

# Generate DB types
pnpm db:types

# Run all apps in dev mode
pnpm dev
```

To run a single app:

```bash
pnpm --filter mobile dev
pnpm --filter doctor-portal dev
pnpm --filter admin-portal dev
pnpm --filter patient-portal dev
```

## Environment Variables

Each app reads from its own `.env.local`. Copy the example file and fill in your Supabase credentials:

```bash
cp apps/patient-portal/.env.example apps/patient-portal/.env.local
```

Required variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Database

Migrations live in `supabase/migrations/`. Apply them locally with:

```bash
pnpm exec supabase db reset
```

## Project Structure

```
healthOraa/
├── apps/
│   ├── mobile/          # Expo Router app
│   ├── doctor-portal/   # Vite + React
│   ├── admin-portal/    # Vite + React
│   └── patient-portal/  # Vite + React
├── packages/
│   ├── types/           # @healthoraa/types
│   ├── validation/      # @healthoraa/validation
│   └── ui/              # @healthoraa/ui
├── supabase/
│   ├── migrations/
│   └── functions/
├── turbo.json
└── pnpm-workspace.yaml
```
