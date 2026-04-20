# Sprint 1 — Algorytm i typy (bez UI, bez Supabase)

## Cel
Fundament pod funkcję symulacji wpisów ewidencji: czyste TypeScript, bez warstwy Supabase, z testami vitest.

---

## Zadania

### S1-1: Instalacja vitest
- `npm install -D vitest`
- Utwórz `vitest.config.ts`

### S1-2: Wydzielenie getLastOdometer
- Przenieś `getLastOdometer()` z `src/app/(app)/wpisy/nowy/page.tsx` do `src/lib/trips/odometer.ts`
- Rozszerz zwracany typ o `lastDate: string | null` (data ostatniego wpisu)
- Zaktualizuj import w `wpisy/nowy/page.tsx`

### S1-3: Typy symulacji
Utwórz `src/lib/simulation/types.ts`:
- `SimulationParams` — parametry wejściowe generatora
- `SimulatedTrip` — pojedynczy wygenerowany wpis (podzbiór TripEntryFormData)

### S1-4: Algorytm generatora
Utwórz `src/lib/simulation/generate.ts`:
- `generateTrips(params: SimulationParams): SimulatedTrip[]`
- Rozkład wpisów w przedziale dat (tripsPerWeek)
- Narastające wartości licznika (odometer continuity)
- Predefiniowane cele i trasy z polskich miast

### S1-5: Testy vitest
Utwórz `src/lib/simulation/generate.test.ts`:
- Poprawna ciągłość licznika
- Liczba wygenerowanych wpisów zgodna z parametrami
- Daty w zadanym przedziale
- Każdy odometer_after > odometer_before
