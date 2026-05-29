-- Fix: replace blanket delete-deny policy with role-based allow for admins
DROP POLICY IF EXISTS tr_delete_deny ON vat_km.trip_entries;

CREATE POLICY tr_delete_admin ON vat_km.trip_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vat_km.profiles p
      JOIN vat_km.vehicles v ON v.company_id = p.company_id
      WHERE p.id = auth.uid()
        AND p.role IN ('administrator', 'ksiegowosc')
        AND v.id = trip_entries.vehicle_id
    )
  );
