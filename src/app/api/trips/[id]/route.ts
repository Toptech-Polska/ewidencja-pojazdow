import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { interpretDbError } from '@/lib/errors/db-errors'

// Pola edytowalne przez inline edit: data, cel, trasa.
// Liczniki (odometer_before, odometer_after) celowo wykluczone —
// ich zmiana wymaga zachowania ciągłości i osobnego narzędzia.
const TripPatchSchema = z.object({
  trip_date:      z.string().date().optional(),
  purpose:        z.string().min(5, 'Min. 5 znaków').max(500).optional(),
  route_from:     z.string().min(2).max(200).optional(),
  route_to:       z.string().min(2).max(200).optional(),
  odometer_after: z.number().int().positive().optional(),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Brak pól do aktualizacji' }
)

function canEdit(role: string) {
  return ['administrator', 'ksiegowosc'].includes(role)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !canEdit(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień do edycji wpisów' }, { status: 403 })

  // Fetch original before update (needed for propagation and date validation)
  const { data: original } = await supabase
    .schema('vat_km').from('trip_entries')
    .select('id, vehicle_id, entry_number, odometer_before, odometer_after, trip_date')
    .eq('id', params.id).single()
  if (!original) return NextResponse.json({ error: 'Wpis nie znaleziony' }, { status: 404 })

  const body = await req.json()
  const parsed = TripPatchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data

  // Z4: server-side date validation
  if (d.trip_date && d.trip_date !== original.trip_date) {
    const [prevRes, nextRes] = await Promise.all([
      supabase.schema('vat_km').from('trip_entries')
        .select('trip_date').eq('vehicle_id', original.vehicle_id)
        .eq('entry_number', original.entry_number - 1).maybeSingle(),
      supabase.schema('vat_km').from('trip_entries')
        .select('trip_date').eq('vehicle_id', original.vehicle_id)
        .eq('entry_number', original.entry_number + 1).maybeSingle(),
    ])
    if (prevRes.data && d.trip_date < prevRes.data.trip_date)
      return NextResponse.json({ error: `Data nie może być wcześniejsza niż ${prevRes.data.trip_date}` }, { status: 422 })
    if (nextRes.data && d.trip_date > nextRes.data.trip_date)
      return NextResponse.json({ error: `Data nie może być późniejsza niż ${nextRes.data.trip_date}` }, { status: 422 })
  }

  // Validate odometer_after > odometer_before (unchanged)
  if (d.odometer_after !== undefined && d.odometer_after <= original.odometer_before)
    return NextResponse.json({ error: 'Licznik po powrocie musi być większy niż przed wyjazdem' }, { status: 422 })

  const updatePayload: Record<string, unknown> = {}
  if (d.trip_date      !== undefined) updatePayload.trip_date      = d.trip_date
  if (d.purpose        !== undefined) updatePayload.purpose        = d.purpose
  if (d.route_from     !== undefined) updatePayload.route_from     = d.route_from
  if (d.route_to       !== undefined) updatePayload.route_to       = d.route_to
  if (d.odometer_after !== undefined) updatePayload.odometer_after = d.odometer_after

  if (Object.keys(updatePayload).length === 0)
    return NextResponse.json({ error: 'Brak pól do aktualizacji' }, { status: 422 })

  // UWAGA: trip_entries ma 3 FK do profiles (driver_id, created_by, confirmed_by).
  // Bez explicit aliasu PostgREST rzuca "more than one relationship" — używamy !driver_id.
  const { data, error } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .update(updatePayload)
    .eq('id', params.id)
    .select('*, vehicles(plate_number, make, model), driver:profiles!driver_id(full_name)')
    .single()

  if (error) return NextResponse.json(interpretDbError(error.message), { status: 400 })

  // Z1: propagate odometer delta to subsequent entries
  if (d.odometer_after !== undefined && d.odometer_after !== original.odometer_after) {
    const delta = d.odometer_after - original.odometer_after
    await supabase.schema('vat_km').rpc('propagate_odometer_delta', {
      p_vehicle_id:      original.vehicle_id,
      p_entry_number_gt: original.entry_number,
      p_delta:           delta,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !canEdit(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień do usuwania wpisów' }, { status: 403 })

  const { error } = await supabase.schema('vat_km').rpc('delete_trip_entry', { p_id: params.id })
  if (error) return NextResponse.json(interpretDbError(error.message), { status: 400 })

  return NextResponse.json({ ok: true })
}
