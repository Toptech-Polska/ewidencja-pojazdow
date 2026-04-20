# CLAUDE.md — ewidencja-pojazdow

Przeczytaj ten plik w całości przed wykonaniem jakiegokolwiek zadania.

---

## Stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Supabase (schema: `vat_km`) — zawsze używaj `.schema('vat_km')` przy każdym zapytaniu
- Zod do walidacji, date-fns do dat (już w package.json)
- Brak frameworka testowego — do Sprint 1 dodaj vitest: `npm install -D vitest`

## Struktura katalogów

```
src/
  app/
    (app)/          ← chronione trasy (wymagają auth)
    (auth)/         ← login
    api/            ← API routes (Server tylko)
  components/
    layout/         ← Sidebar.tsx, Topbar.tsx
  hooks/            ← useProfile.ts (role kierowcy)
  lib/
    supabase/       ← client.ts, server.ts, middleware.ts
    validations/    ← schematy Zod
  types/
    database.ts     ← JEDYNE źródło typów — nie duplikuj typów w innych plikach
```

## Wzorce — stosuj konsekwentnie

### Supabase Server (API routes, Server Components)
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

### Supabase Client (komponenty 'use client')
```typescript
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Guard autentykacji w API route
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Pobieranie profilu i roli w API route
```typescript
const { data: profile } = await supabase
  .schema('vat_km').from('profiles').select('role, company_id').eq('id', user.id).single()
if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```

### Klasy CSS formularzy (globals.css)
Zawsze stosuj istniejące klasy: `form-label`, `form-input`, `form-input-error`, `form-error`, `form-hint`, `btn-primary`, `btn-outline`, `card`

### Struktura Server Component z auth guardem
```typescript
// app/(app)/[route]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // opcjonalny guard roli:
  const { data: profile } = await supabase.schema('vat_km').from('profiles')
    .select('role').eq('id', user.id).single()
  if (!['kierowca', 'administrator'].includes(profile?.role ?? '')) redirect('/dashboard')
  // ...render
}
```

## Krytyczne ograniczenia bazy danych

### 1. Trigger `validate_odometer_continuity`
Każdy nowy `trip_entry` musi mieć `odometer_before` dokładnie równy `odometer_after` poprzedniego wpisu dla tego samego `vehicle_id`. Naruszenie = błąd DB z czytelnym komunikatem.

**Konsekwencja:** bulk insert symulacji MUSI być posortowany chronologicznie i każdy wpis musi mieć poprawne wartości licznika narastająco.

### 2. RPC `next_entry_number`
Każdy wpis wymaga unikalnego `entry_number` pobranego przez:
```typescript
const { data: nextNum } = await supabase.schema('vat_km')
  .rpc('next_entry_number', { p_vehicle_id: vehicleId })
```
Przy bulk insert użyj nowego RPC `next_n_entry_numbers` (dodanego w Sprint 1).

### 3. Schema `vat_km`
Każde zapytanie Supabase MUSI zawierać `.schema('vat_km')`. Bez tego zapytania trafiają do publicznego schematu i zwracają błąd.

## Role użytkowników

```typescript
type UserRole = 'administrator' | 'ksiegowosc' | 'kierowca' | 'kontrola'
```

- `canAddTrips`: administrator, ksiegowosc, kierowca
- `canViewSimulation`: **kierowca, administrator** (nowe)
- `canManageDriverProfiles`: **kierowca (własne), administrator (wszystkie w firmie)** (nowe)

## Istniejąca funkcja do reużycia

`getLastOdometer()` w `src/app/(app)/wpisy/nowy/page.tsx` — w Sprint 1 przenieś ją do `src/lib/trips/odometer.ts` i rozszerz o zwracanie daty ostatniego wpisu.

## Nowe pliki w tym projekcie

Zadania podzielone na sprinty w katalogu `tasks/`:
- `tasks/sprint-1.md` — algorytm i typy (bez UI, bez Supabase)
- `tasks/sprint-2.md` — API routes
- `tasks/sprint-3.md` — UI i Sidebar
