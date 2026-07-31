# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # development server (localhost:3000)
npm run build        # production build + type check
npm run typecheck    # tsc --noEmit only
npm run lint         # eslint
npm run test         # vitest run (unit tests)
npm run test:watch   # vitest watch mode
npm run supabase:types  # regenerate src/types/database.ts from live Supabase schema
```

Run a single test file: `npx vitest run src/lib/simulation/generate.test.ts`

## Architecture

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase (`@supabase/ssr`) · Zod · date-fns · Vitest

**Deploy:** Vercel — auto-deploys from GitHub `main` to https://pojazdy.tsps.pl (repo contains `netlify.toml` but actual deployment is via Vercel)

### Route structure

```
src/app/
  (auth)/login/         # login page (currently email/password, Google OAuth migration pending)
  auth/callback/        # OAuth callback route (excluded from middleware matcher)
  setup/                # one-time first-run setup
  (app)/                # all protected pages (middleware guards this group)
    dashboard/
    wpisy/              # trip entries — list + new entry form
    raporty/            # reports + PDF/CSV export
    pojazdy/            # vehicle management
    compliance/         # VAT-26 compliance tracking
    symulacja/          # trip simulation
    profil/             # user profile + simulation location config
    admin/              # user management (administrator role only)
  api/
    vehicles/           # CRUD — GET all, POST create
    trips/              # trip entry CRUD + odometer propagation RPCs
    vat26/              # mark VAT-26 as filed
    profiles/           # user profile CRUD
    simulation/         # trip simulation API
    loans/              # vehicle loans
    places/             # location autocomplete
    setup/              # first-run setup endpoint
```

### Supabase — critical rules

1. **Always use `.schema('vat_km')`** on every query — all app data lives in the `vat_km` schema, not `public`.
2. **PostgREST FK ambiguity** — `trip_entries` has 3 FKs to `profiles` (`driver_id`, `created_by`, `confirmed_by`). Always use explicit alias: `driver:profiles!driver_id(full_name)` or PostgREST will throw "more than one relationship".
3. **Odometer continuity trigger** — `vat_km.validate_odometer_continuity` fires on every `trip_entries` INSERT/UPDATE. Each entry's `odometer_before` must equal the previous entry's `odometer_after` for the same vehicle. Use the `vat_km.insert_trip_after()` and `vat_km.delete_trip_entry()` RPCs for mid-list insert/delete — they handle renumbering and delta propagation automatically.
4. **Entry numbers** — use `vat_km.next_entry_number()` / `vat_km.next_n_entry_numbers(p_vehicle_id, p_count)` RPCs to allocate sequence numbers; never compute them manually.
5. **Supabase clients:** `src/lib/supabase/server.ts` for Server Components and Route Handlers · `src/lib/supabase/client.ts` for Client Components · `src/lib/supabase/middleware.ts` for session refresh in middleware.

### Multi-company (multi-tenant)

The schema is multi-tenant via `company_id` FK present on `vehicles`, `profiles`, `v_monthly_summary`, `v_vat26_compliance`, and other views. The `vat_km.companies` table stores company master data. Vehicles are assigned to a company; users (profiles) also have a `company_id`. Reports and PDFs must use the company associated with the selected vehicle, not a global singleton.

### Auth & roles

Auth is Supabase Google OAuth. Callback at `/auth/callback/route.ts` exchanges code for session, checks `auth_hub.allowed_emails` whitelist, then redirects to `/dashboard` or `/login?error=unauthorized`.

Roles (`UserRole`): `administrator | ksiegowosc | kierowca | kontrola`

Role checks happen server-side by reading `vat_km.profiles` — never trust client-passed role. The `auth_hub` schema (shared across Toptech apps) is not exposed via PostgREST; use `src/lib/auth_hub.ts` helpers which call admin-client RPCs.

### Data model summary

- `companies` — company master (name, NIP, KRS, REGON, address)
- `profiles` — one row per authenticated user; `company_id`, `role`, `role_assigned`, `is_active`
- `vehicles` — `company_id` FK, odometer start, VAT-26 fields, status
- `trip_entries` — core record; odometer chain enforced by DB trigger
- `entry_sequences` — one row per vehicle; atomically tracks last allocated entry number
- `v_monthly_summary` / `v_vat26_compliance` — DB views; query directly via `.from('v_...')`
- `odometer_snapshots` — period-close snapshots
- `audit_log` — insert-only; written by server on significant mutations

### Types

`src/types/database.ts` is the single source of truth for all TypeScript interfaces. Regenerate after any schema change with `npm run supabase:types`. Never hand-edit the generated block.

### PDF export

Reports (`raporty/`) and VAT-26 PDFs are generated client-side as HTML strings, opened in a new window, and printed via `window.print()`. No server-side PDF library. Company data (name, NIP, KRS, REGON, address) for the PDF header comes from the vehicle's associated company record.

### Production data safety

The production database at pojazdy.tsps.pl contains live company vehicle records. All schema migrations must be **additive only** (ADD COLUMN, CREATE TABLE, CREATE INDEX). Never use DROP, TRUNCATE, or DELETE in migrations without explicit user confirmation and a verified backup. Always state whether a proposed change is safe/additive before applying.
