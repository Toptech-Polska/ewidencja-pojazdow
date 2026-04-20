import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SimulationSchema } from '@/lib/validations/simulation'
import { generateTrips } from '@/lib/simulation/generate'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()

  if (!profile)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['administrator', 'kierowca'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień do generowania symulacji' }, { status: 403 })

  const body = await req.json()
  const parsed = SimulationSchema.safeParse(body)

  if (!parsed.success)
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    )

  const { vehicle_id, startDate, endDate, tripsPerWeek, avgKmPerTrip } = parsed.data

  // Weryfikuj że pojazd należy do firmy użytkownika
  const { data: vehicle } = await supabase
    .schema('vat_km').from('vehicles')
    .select('id, odometer_start, company_id')
    .eq('id', vehicle_id).eq('company_id', profile.company_id)
    .single()

  if (!vehicle)
    return NextResponse.json({ error: 'Pojazd nie istnieje lub brak dostępu' }, { status: 404 })

  // Pobierz aktualny odometer z DB — trigger wymaga ciągłości
  const { data: lastEntry } = await supabase
    .schema('vat_km').from('trip_entries')
    .select('odometer_after')
    .eq('vehicle_id', vehicle_id)
    .order('entry_number', { ascending: false })
    .limit(1).single()

  const startOdometer = lastEntry?.odometer_after ?? vehicle.odometer_start

  const trips = generateTrips({
    vehicleId: vehicle_id,
    startOdometer,
    startDate,
    endDate,
    tripsPerWeek,
    avgKmPerTrip,
  })

  if (trips.length === 0)
    return NextResponse.json({ count: 0, firstEntryNumber: null })

  // Zarezerwuj n numerów wpisów atomicznie
  const { data: firstNum, error: seqError } = await supabase
    .schema('vat_km')
    .rpc('next_n_entry_numbers', { p_vehicle_id: vehicle_id, p_count: trips.length })

  if (seqError)
    return NextResponse.json({ error: seqError.message }, { status: 400 })

  const rows = trips.map((t, i) => ({
    vehicle_id:      t.vehicle_id,
    trip_date:       t.trip_date,
    purpose:         t.purpose,
    route_from:      t.route_from,
    route_to:        t.route_to,
    odometer_before: t.odometer_before,
    odometer_after:  t.odometer_after,
    entry_number:    firstNum + i,
    created_by:      user.id,
  }))

  const { error: insertError } = await supabase
    .schema('vat_km').from('trip_entries').insert(rows)

  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 400 })

  return NextResponse.json({ count: trips.length, firstEntryNumber: firstNum }, { status: 201 })
}
