import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { interpretDbError } from '@/lib/errors/db-errors'

// Pola edytowalne przez inline edit: data, cel, trasa.
// Liczniki (odometer_before, odometer_after) celowo wykluczone —
// ich zmiana wymaga zachowania ciągłości i osobnego narzędzia.
const TripPatchSchema = z.object({
  trip_date:  z.string().date().optional(),
  purpose:    z.string().min(5, 'Min. 5 znaków').max(500).optional(),
  route_from: z.string().min(2).max(200).optional(),
  route_to:   z.string().min(2).max(200).optional(),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Brak pól do aktualizacji' }
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['administrator', 'ksiegowosc'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień do edycji wpisów' }, { status: 403 })

  const body = await req.json()
  const parsed = TripPatchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  const updatePayload: Record<string, unknown> = {}
  if (d.trip_date  !== undefined) updatePayload.trip_date  = d.trip_date
  if (d.purpose    !== undefined) updatePayload.purpose    = d.purpose
  if (d.route_from !== undefined) updatePayload.route_from = d.route_from
  if (d.route_to   !== undefined) updatePayload.route_to   = d.route_to

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
  return NextResponse.json(data)
}
