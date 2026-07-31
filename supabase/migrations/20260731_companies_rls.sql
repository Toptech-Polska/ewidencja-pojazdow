-- RLS policies: administratorzy mogą zarządzać podmiotami
-- SELECT już istnieje (app czytała companies przed tą zmianą)

CREATE POLICY "administrators can insert companies"
ON vat_km.companies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vat_km.profiles
    WHERE id = auth.uid()
      AND role = 'administrator'
      AND role_assigned = true
  )
);

CREATE POLICY "administrators can update companies"
ON vat_km.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM vat_km.profiles
    WHERE id = auth.uid()
      AND role = 'administrator'
      AND role_assigned = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vat_km.profiles
    WHERE id = auth.uid()
      AND role = 'administrator'
      AND role_assigned = true
  )
);
