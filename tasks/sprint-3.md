# Sprint 3 — UI i Sidebar

## Cel
Warstwa widoków dla funkcji symulacji i zarządzania profilem. Wszystkie strony chronione auth guardem. Sidebar rozbudowany o nowe pozycje.

---

## Zadania

### S3-1: Napraw błędy TS w Sidebar
Zdefinuj typ `NavItem` z opcjonalnymi polami `badge?`, `adminOnly?`, `driverOrAdmin?`.
Zastąp inferencję union-type jawną typizacją tablicy NAV.

### S3-2: Rozszerz useProfile o nowe uprawnienia
Dodaj do `src/hooks/useProfile.ts`:
- `canViewSimulation`: administrator, kierowca
- `canManageDriverProfiles`: administrator, kierowca

### S3-3: Sidebar — nowe pozycje
- "Symulacja" (ikona: ⟳, href: /symulacja) — widoczna dla administrator i kierowca
- "Mój profil" (ikona: ◉, href: /profil) — widoczna dla wszystkich ról

### S3-4: Strona /symulacja
Utwórz `src/app/(app)/symulacja/page.tsx` (Server Component z auth guardem):
- Guard roli: administrator lub kierowca
- Client component z formularzem: wybór pojazdu, daty od/do, wpisów/tydzień, avg km
- Po submit: POST /api/simulation → pokaż wynik (ile wpisów dodano)

### S3-5: Strona /profil
Utwórz `src/app/(app)/profil/page.tsx`:
- Dostępna dla wszystkich zalogowanych ról
- Formularz edycji full_name → PATCH /api/profiles/[id]
- Pokazuje: email, rola (read-only), data dołączenia

### S3-6: Admin — podpięcie przycisku "Edytuj"
Zamień admin/page.tsx na hybrid: Server Component ładuje dane,
nowy `AdminUsersClient.tsx` obsługuje inline-edit (role, is_active) → PATCH /api/profiles/[id]
