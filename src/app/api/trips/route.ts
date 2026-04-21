import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TripEntrySchema } from '@/lib/validations/trip'
import { interpretDbError } from '@/lib/errors/db-errors'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = TripEntrySchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const data = parsed.data
  const { data: nextNum, error: seqError } = await supabase
    .schema('vat_km').rpc('next_entry_number', { p_vehicle_id: data.vehicle_id })
  if (seqError) return NextResponse.json(interpretDbError(seqError.message), { status: 400 })

  const { data: entry, error: insertError } = await supabase
    .schema('vat_km').from('trip_entries')
    .insert({
      vehicle_id: data.vehicle_id, trip_date: data.trip_date, purpose: data.purpose,
      route_from: data.route_from, route_to: data.route_to,
      odometer_before: data.odometer_before, odometer_after: data.odometer_after,
      driver_id: data.driver_id || null,
      driver_name_external: data.driver_name_external || null,
      notes: data.notes || null, entry_number: nextNum, created_by: user.id,
    }).select().single()
  if (insertError) return NextResponse.json(interpretDbError(insertError.message), { status: 400 })

  return NextResponse.json(entry, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicle_id')
  const pending = searchParams.get('pending') === 'true'

  let query = supabase.schema('vat_km').from('trip_entries')
    .select('*, vehicles(plate_number, make, model)').order('entry_number', { ascending: false })
  if (vehicleId) query = query.eq('vehicle_id', vehicleId)
  if (pending) query = query.eq('requires_confirmation', true).eq('confirmed_by_company', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
