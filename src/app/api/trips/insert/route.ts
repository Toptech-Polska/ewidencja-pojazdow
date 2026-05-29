import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { interpretDbError } from '@/lib/errors/db-errors'

const InsertSchema = z.object({
  vehicle_id:         z.string().uuid(),
  after_entry_number: z.number().int().positive(),
  trip_date:          z.string().date(),
  purpose:            z.string().min(5, 'Min. 5 znaków').max(500),
  route_from:         z.string().min(2).max(200),
  route_to:           z.string().min(2).max(200),
  kilometers:         z.number().int().min(1).max(99999),
  driver_id:          z.string().uuid().optional().nullable(),
  driver_name_external: z.string().max(200).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['administrator', 'ksiegowosc', 'kierowca'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  const body = await req.json()
  const parsed = InsertSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Błąd walidacji', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data

  // Z4: date validation relative to neighboring entries
  const [prevRes, nextRes] = await Promise.all([
    supabase.schema('vat_km').from('trip_entries')
      .select('trip_date').eq('vehicle_id', d.vehicle_id)
      .eq('entry_number', d.after_entry_number).maybeSingle(),
    supabase.schema('vat_km').from('trip_entries')
      .select('trip_date').eq('vehicle_id', d.vehicle_id)
      .eq('entry_number', d.after_entry_number + 1).maybeSingle(),
  ])
  if (prevRes.data && d.trip_date < prevRes.data.trip_date)
    return NextResponse.json({ error: `Data nie może być wcześniejsza niż ${prevRes.data.trip_date}` }, { status: 422 })
  if (nextRes.data && d.trip_date > nextRes.data.trip_date)
    return NextResponse.json({ error: `Data nie może być późniejsza niż ${nextRes.data.trip_date}` }, { status: 422 })

  const { data: newId, error } = await supabase.schema('vat_km').rpc('insert_trip_after', {
    p_vehicle_id:           d.vehicle_id,
    p_after_number:         d.after_entry_number,
    p_trip_date:            d.trip_date,
    p_purpose:              d.purpose,
    p_route_from:           d.route_from,
    p_route_to:             d.route_to,
    p_kilometers:           d.kilometers,
    p_driver_id:            d.driver_id ?? null,
    p_driver_name_external: d.driver_name_external ?? null,
    p_created_by:           user.id,
  })

  if (error) return NextResponse.json(interpretDbError(error.message), { status: 400 })

  return NextResponse.json({ id: newId }, { status: 201 })
}
