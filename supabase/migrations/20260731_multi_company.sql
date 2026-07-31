-- ============================================================
-- Multi-company: Toptech Assets + pełne dane firm
-- ADDYTYWNE — zero zmian w trip_entries, istniejące dane bez zmian
-- ============================================================

-- 1. Dodaj kolumnę krs (addytywne, nullable)
ALTER TABLE vat_km.companies ADD COLUMN IF NOT EXISTS krs TEXT;

-- 2. Uzupełnij dane Toptech Polska (tylko metadane firmy, nie dotyka pojazdów ani wpisów)
UPDATE vat_km.companies
SET
  name    = 'TOPTECH Polska Spółka z o.o.',
  krs     = '0001214393',
  regon   = '542685142',
  address = 'ul. Inżynierska 8, 67-100 Nowa Sól',
  nip     = '9252151335'
WHERE nip = '9252151335';

-- 3. Wstaw Toptech Assets (nowy wiersz, nie dotyka istniejących)
INSERT INTO vat_km.companies (name, nip, krs, regon, address)
VALUES (
  'TOPTECH ASSETS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  '9252149700',
  '0001174871',
  '541805800',
  'Inżynierska 8, 67-100 Nowa Sól'
)
ON CONFLICT DO NOTHING;

-- 4. Przypisz Lexusa do Toptech Assets
--    Bezpieczne: Lexus nie ma żadnych trip_entries (zerowe ryzyko)
UPDATE vat_km.vehicles
SET company_id = (SELECT id FROM vat_km.companies WHERE nip = '9252149700')
WHERE make = 'Lexus';
