-- Migration: fix validate_odometer_continuity (bugfix + bypass mechanism)

CREATE OR REPLACE FUNCTION vat_km.validate_odometer_continuity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_prev_after    integer;
  v_vehicle_start integer;
  v_bypass        text;
begin
  -- Bypass for controlled multi-row RPC operations (set via set_config)
  BEGIN
    v_bypass := current_setting('vat_km.bypass_continuity', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Skip if odometer didn't change (UPDATE of date/purpose/route only)
  IF TG_OP = 'UPDATE'
     AND NEW.odometer_before = OLD.odometer_before
     AND NEW.odometer_after  = OLD.odometer_after THEN
    RETURN NEW;
  END IF;

  -- BUGFIX: previous entry = entry_number < NEW.entry_number (was missing)
  SELECT odometer_after
    INTO v_prev_after
    FROM vat_km.trip_entries
   WHERE vehicle_id = NEW.vehicle_id
     AND entry_number < NEW.entry_number
     AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
   ORDER BY entry_number DESC
   LIMIT 1;

  IF v_prev_after IS NOT NULL THEN
    IF NEW.odometer_before <> v_prev_after THEN
      RAISE EXCEPTION
        'Niezgodność stanu licznika: poprzedni wpis zakończył się na % km, '
        'a nowy wpis zaczyna się od % km. Wymagana ciągłość.',
        v_prev_after, NEW.odometer_before;
    END IF;
  ELSE
    -- First entry: cannot start below vehicle's odometer_start
    SELECT odometer_start INTO v_vehicle_start
      FROM vat_km.vehicles
     WHERE id = NEW.vehicle_id;

    IF NEW.odometer_before < v_vehicle_start THEN
      RAISE EXCEPTION
        'Stan licznika przed wyjazdem (% km) nie może być mniejszy niż '
        'stan licznika na dzień rozpoczęcia ewidencji (% km).',
        NEW.odometer_before, v_vehicle_start;
    END IF;
  END IF;

  RETURN NEW;
end;
$function$;

-- Helper: verify odometer chain consistency for a vehicle after bulk operations
CREATE OR REPLACE FUNCTION vat_km.assert_odometer_chain(p_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM (
    SELECT entry_number, odometer_before,
           LAG(odometer_after) OVER (ORDER BY entry_number) AS prev_after
    FROM vat_km.trip_entries
    WHERE vehicle_id = p_vehicle_id
  ) t
  WHERE prev_after IS NOT NULL AND prev_after <> odometer_before
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Wewnętrzny błąd: łańcuch liczników niespójny po operacji.';
  END IF;
END;
$$;

-- propagate_odometer_delta
CREATE OR REPLACE FUNCTION vat_km.propagate_odometer_delta(
  p_vehicle_id      uuid,
  p_entry_number_gt int,
  p_delta           int
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_delta = 0 THEN RETURN; END IF;

  PERFORM set_config('vat_km.bypass_continuity', 'on', true);

  UPDATE vat_km.trip_entries
  SET
    odometer_before = odometer_before + p_delta,
    odometer_after  = odometer_after  + p_delta,
    updated_at      = now()
  WHERE vehicle_id   = p_vehicle_id
    AND entry_number > p_entry_number_gt;

  PERFORM vat_km.assert_odometer_chain(p_vehicle_id);

  PERFORM set_config('vat_km.bypass_continuity', 'off', true);
END;
$$;

-- delete_trip_entry
CREATE OR REPLACE FUNCTION vat_km.delete_trip_entry(p_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_vehicle_id   uuid;
  v_entry_number int;
  v_delta        int;
BEGIN
  PERFORM set_config('vat_km.bypass_continuity', 'on', true);

  SELECT vehicle_id, entry_number, -(odometer_after - odometer_before)
  INTO   v_vehicle_id, v_entry_number, v_delta
  FROM   vat_km.trip_entries
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wpis nie znaleziony';
  END IF;

  DELETE FROM vat_km.trip_entries WHERE id = p_id;

  -- Two-step renumber to avoid unique constraint conflict
  UPDATE vat_km.trip_entries
  SET    entry_number = entry_number + 1000000, updated_at = now()
  WHERE  vehicle_id   = v_vehicle_id
    AND  entry_number > v_entry_number;

  UPDATE vat_km.trip_entries
  SET    entry_number = entry_number - 1000001, updated_at = now()
  WHERE  vehicle_id   = v_vehicle_id
    AND  entry_number > 1000000 + v_entry_number;

  -- Correct odometers
  UPDATE vat_km.trip_entries
  SET
    odometer_before = odometer_before + v_delta,
    odometer_after  = odometer_after  + v_delta,
    updated_at      = now()
  WHERE  vehicle_id   = v_vehicle_id
    AND  entry_number >= v_entry_number;

  UPDATE vat_km.entry_sequences
  SET    last_number = last_number - 1
  WHERE  vehicle_id  = v_vehicle_id;

  PERFORM vat_km.assert_odometer_chain(v_vehicle_id);

  PERFORM set_config('vat_km.bypass_continuity', 'off', true);
END;
$$;

-- insert_trip_after
CREATE OR REPLACE FUNCTION vat_km.insert_trip_after(
  p_vehicle_id           uuid,
  p_after_number         int,
  p_trip_date            date,
  p_purpose              text,
  p_route_from           text,
  p_route_to             text,
  p_kilometers           int,
  p_driver_id            uuid DEFAULT NULL,
  p_driver_name_external text DEFAULT NULL,
  p_created_by           uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_odometer_before int;
  v_odometer_after  int;
  v_new_number      int;
  v_new_id          uuid;
BEGIN
  PERFORM set_config('vat_km.bypass_continuity', 'on', true);

  SELECT odometer_after INTO v_odometer_before
  FROM   vat_km.trip_entries
  WHERE  vehicle_id = p_vehicle_id AND entry_number = p_after_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wpis nr % nie znaleziony', p_after_number;
  END IF;

  v_odometer_after := v_odometer_before + p_kilometers;
  v_new_number     := p_after_number + 1;

  -- Two-step shift to avoid unique constraint conflict
  UPDATE vat_km.trip_entries
  SET    entry_number = entry_number + 1000000, updated_at = now()
  WHERE  vehicle_id   = p_vehicle_id
    AND  entry_number > p_after_number;

  UPDATE vat_km.trip_entries
  SET    entry_number = entry_number - 1000000 + 1, updated_at = now()
  WHERE  vehicle_id   = p_vehicle_id
    AND  entry_number > 1000000 + p_after_number;

  INSERT INTO vat_km.trip_entries (
    vehicle_id, entry_number, trip_date, purpose, route_from, route_to,
    odometer_before, odometer_after,
    driver_id, driver_name_external, requires_confirmation, created_by
  ) VALUES (
    p_vehicle_id, v_new_number, p_trip_date, p_purpose, p_route_from, p_route_to,
    v_odometer_before, v_odometer_after,
    p_driver_id, p_driver_name_external,
    (p_driver_name_external IS NOT NULL AND p_driver_name_external <> ''),
    p_created_by
  )
  RETURNING id INTO v_new_id;

  -- Propagate km delta to entries after the new one
  UPDATE vat_km.trip_entries
  SET
    odometer_before = odometer_before + p_kilometers,
    odometer_after  = odometer_after  + p_kilometers,
    updated_at      = now()
  WHERE  vehicle_id   = p_vehicle_id
    AND  entry_number > v_new_number;

  UPDATE vat_km.entry_sequences
  SET    last_number = last_number + 1
  WHERE  vehicle_id  = p_vehicle_id;

  PERFORM vat_km.assert_odometer_chain(p_vehicle_id);

  PERFORM set_config('vat_km.bypass_continuity', 'off', true);

  RETURN v_new_id;
END;
$$;
