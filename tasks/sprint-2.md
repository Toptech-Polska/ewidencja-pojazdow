# Sprint 2 — API Routes

## Cel
Warstwa serwerowa dla funkcji symulacji i zarządzania profilami. Każda route musi mieć auth guard + guard roli zgodny z CLAUDE.md.

---

## Zadania

### S2-1: SimulationSchema (Zod)
Utwórz `src/lib/validations/simulation.ts`:
- `SimulationSchema` — walidacja ciała POST /api/simulation
- Pola: vehicle_id (uuid), startDate, endDate (daty YYYY-MM-DD, endDate > startDate),
  tripsPerWeek (1–14), avgKmPerTrip (5–500)

### S2-2: Migracja SQL — next_n_entry_numbers
Utwórz `supabase/migrations/20240501_next_n_entry_numbers.sql`:
- Funkcja `vat_km.next_n_entry_numbers(p_vehicle_id uuid, p_count int) RETURNS int`
- Atomicznie inkrementuje sekwencję o p_count, zwraca pierwszy z n numerów

### S2-3: POST /api/simulation
Utwórz `src/app/api/simulation/route.ts`:
- Role: administrator, kierowca (canViewSimulation)
- Pobierz aktualny odometer z DB (nadpisz startOdometer z params — trigger validate_odometer_continuity wymaga ciągłości)
- Wygeneruj wpisy przez generateTrips()
- Pobierz n numerów przez next_n_entry_numbers RPC
- Bulk insert do trip_entries
- Zwróć { count, firstEntryNumber }

### S2-4: GET /api/profiles
Utwórz `src/app/api/profiles/route.ts`:
- Auth guard (każda rola)
- Zwraca profile z tej samej company_id co zalogowany użytkownik

### S2-5: PATCH /api/profiles/[id]
Utwórz `src/app/api/profiles/[id]/route.ts`:
- kierowca: może edytować tylko własny profil (pole: full_name)
- administrator: może edytować każdy profil w firmie (pola: full_name, role, is_active)
- Walidacja przez ProfileUpdateSchema (Zod)

### S2-6: Guard roli w istniejących route'ach
- `PATCH /api/trips/[id]/confirm` — dodaj guard: tylko administrator lub ksiegowosc
- `POST /api/loans` — dodaj guard: administrator, ksiegowosc, kierowca
