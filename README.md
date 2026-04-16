# EwidencjaVAT

Aplikacja webowa do prowadzenia ewidencji przebiegu pojazdów firmowych,  
zgodna z **art. 86a ustawy o VAT** (100% odliczenie VAT od samochodów używanych wyłącznie służbowo).

---

## Stack

| Warstwa     | Technologia                        |
|------------|-------------------------------------|
| Frontend   | Next.js 14 (App Router) + TypeScript |
| Styling    | Tailwind CSS                        |
| Backend    | Supabase (PostgreSQL + Auth + RLS)  |
| Walidacja  | Zod                                 |
| Eksport    | xlsx (CSV/XLSX client-side)         |
| Hosting    | Vercel (frontend) + Supabase Cloud  |

---

## Szybki start

### 1. Klonuj i zainstaluj

```bash
git clone <repo-url> ewidencja-km
cd ewidencja-km
npm install
```

### 2. Zmienne środowiskowe

```bash
cp .env.local.example .env.local
```

Otwórz `.env.local` i uzupełnij klucze z dashboardu Supabase:
- **Dashboard** → https://supabase.com/dashboard/project/cukohoqgvcsvmopvivjt/settings/api
- Skopiuj **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Skopiuj **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Skopiuj **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` nigdy nie może trafić do klienta — zawsze `SUPABASE_SERVICE_ROLE_KEY`, bez prefiksu `NEXT_PUBLIC_`.

### 3. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja dostępna pod: **http://localhost:3000**

### 4. Pierwsze uruchomienie — utwórz konto administratora

Wejdź na: **http://localhost:3000/setup**

Wypełnij formularz:
- Nazwa spółki i NIP
- Imię i nazwisko administratora
- Email i hasło

> ⚠️ Po pierwszym uruchomieniu usuń lub zabezpiecz trasę `/setup`.

---

## Schemat bazy danych

Wszystkie tabele znajdują się w schemacie **`vat_km`** (izolacja od pozostałych tabel projektu Supabase).

```
vat_km.companies          — spółki / podatnicy VAT
vat_km.profiles           — użytkownicy z rolami
vat_km.vehicles           — pojazdy z danymi VAT-26
vat_km.trip_entries       — wpisy ewidencji przebiegu
vat_km.vehicle_loans      — udostępnienia pojazdu
vat_km.odometer_snapshots — stany licznika na koniec okresu
vat_km.entry_sequences    — atomowa numeracja wpisów
vat_km.audit_log          — historia każdej zmiany
```

Widoki raportowe:
- `v_monthly_summary` — km per pojazd per miesiąc
- `v_driver_summary` — km per kierowca
- `v_vat26_compliance` — status VAT-26 z obliczonym terminem
- `v_pending_confirmations` — wpisy czekające na potwierdzenie

---

## Role użytkowników

| Rola            | Uprawnienia                                              |
|-----------------|----------------------------------------------------------|
| `administrator` | Pełny dostęp                                             |
| `ksiegowosc`    | Wpisy, zestawienia, VAT-26, zatwierdzanie                |
| `kierowca`      | Tylko własne wpisy                                       |
| `kontrola`      | Odczyt wszystkiego + eksport + audit log                 |

---

## API Endpoints

| Metoda   | Ścieżka                        | Opis                                    |
|----------|--------------------------------|-----------------------------------------|
| `GET`    | `/api/trips`                   | Lista wpisów (opcjonalnie filtr)        |
| `POST`   | `/api/trips`                   | Nowy wpis (z walidacją Zod + triggerem) |
| `PATCH`  | `/api/trips/[id]/confirm`      | Zatwierdź wpis zewnętrzny               |
| `GET`    | `/api/vehicles`                | Lista pojazdów                          |
| `POST`   | `/api/vehicles`                | Dodaj pojazd                            |
| `POST`   | `/api/vat26`                   | Oznacz VAT-26 jako złożony             |
| `POST`   | `/api/setup`                   | Pierwsze uruchomienie — admin           |

---

## Walidacje biznesowe (art. 86a ustawy o VAT)

Triggery na poziomie bazy danych zapewniają:
- **Ciągłość numeracji** — `next_entry_number()` gwarantuje brak luk
- **Spójność licznika** — `validate_odometer_continuity()` blokuje wpisy z niepoprawnym licznikiem
- **Auto-oznaczanie** — `set_requires_confirmation()` flaguje wpisy kierowców zewnętrznych
- **Termin VAT-26** — `compute_vat26_deadline()` oblicza 25. dzień miesiąca następnego
- **Audit log** — każda zmiana zapisywana automatycznie

---

## Generowanie typów TypeScript

Po zmianach w schemacie Supabase:

```bash
npm run supabase:types
```

Wymaga zainstalowanego Supabase CLI: `npm install -g supabase`

---

## Deployment (Vercel)

```bash
# Zainstaluj Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Ustaw zmienne środowiskowe w Vercel Dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

---

## Struktura projektu

```
src/
├── app/
│   ├── (auth)/login/          ← Strona logowania
│   ├── (app)/
│   │   ├── dashboard/         ← Dashboard z KPI
│   │   ├── pojazdy/           ← Lista i karty pojazdów
│   │   ├── wpisy/             ← Ewidencja wpisów + formularz
│   │   ├── raporty/           ← Zestawienia z filtrami
│   │   ├── compliance/        ← VAT-26 i alerty
│   │   └── admin/             ← Zarządzanie użytkownikami
│   ├── api/                   ← Route Handlers (REST API)
│   └── setup/                 ← Pierwsze uruchomienie
├── components/
│   └── layout/                ← Sidebar, Topbar
├── hooks/
│   └── useProfile.ts          ← Profil i rola zalogowanego
├── lib/
│   ├── supabase/              ← Klienty: client.ts, server.ts
│   ├── validations/           ← Schematy Zod
│   └── vat26/                 ← Logika terminów VAT-26
└── types/
    └── database.ts            ← Typy TypeScript (z bazy)
```

---

## Następne kroki

- [ ] Etap 5 — szczegółowa karta pojazdu z historią licznika
- [ ] Etap 6 — generowanie PDF przez Supabase Edge Function
- [ ] Etap 7 — powiadomienia email o terminach VAT-26 (pg_cron + Resend)
- [ ] Etap 8 — PWA / formularz offline dla kierowców

---

*Toptech Polska Sp. z o.o. — EwidencjaVAT v0.1.0*
