-- Atomically reserves p_count consecutive entry numbers for a vehicle.
-- Returns the FIRST of the reserved numbers.
-- Use: entry_number = first, first+1, ..., first+p_count-1
CREATE OR REPLACE FUNCTION vat_km.next_n_entry_numbers(p_vehicle_id uuid, p_count int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_first int;
BEGIN
  UPDATE vat_km.entry_sequences
  SET    last_number = last_number + p_count
  WHERE  vehicle_id  = p_vehicle_id
  RETURNING last_number - p_count + 1 INTO v_first;

  IF v_first IS NULL THEN
    RAISE EXCEPTION 'Brak sekwencji wpisów dla pojazdu %', p_vehicle_id;
  END IF;

  RETURN v_first;
END;
$$;
