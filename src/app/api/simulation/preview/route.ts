import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SimulationSchema } from '@/lib/validations/simulation'
import { generateTrips } from '@/lib/simulation/generate'
import { getDistances, distanceKey } from '@/lib/simulation/maps'
import type { SimulationConfig } from '@/types/database'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id, simulation_config').eq('id', user.id).single()
  if (!profile || !['administrator', 'kierowca'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 })

  const simConfig = profile.simulation_config as SimulationConfig | null
  const locations = simConfig?.locations ?? []
  if (locations.length < 2) {
    return NextResponse.json({
      code: 'no_simulation_config',
      message: 'Za malo lokalizacji symulacji.',
      hint: 'Przejdz do Mojego profilu i dodaj co najmniej 2 lokalizacje (np. siedziba firmy i dom).',
    }, { status: 400 })
  }

  const body = await req.json()
  const parsed = SimulationSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { vehicle_id, startDate, endDate, tripsPerWeek } = parsed.data

  const { data: vehicle } = await supabase
    .schema('vat_km').from('vehicles')
    .select('id, odometer_start')
    .eq('id', vehicle_id).eq('company_id', profile.company_id).single()
  if (!vehicle) return NextResponse.json({ error: 'Pojazd nie istnieje lub brak dostepu' }, { status: 404 })

  const { data: lastEntry } = await supabase
    .schema('vat_km').from('trip_entries')
    .select('odometer_after').eq('vehicle_id', vehicle_id)
    .order('entry_number', { ascending: false }).limit(1).single()

  const startOdometer = lastEntry?.odometer_after ?? vehicle.odometer_start
  const drafts = generateTrips({ vehicleId: vehicle_id, startOdometer, startDate, endDate, tripsPerWeek, locations })
  if (drafts.length === 0) return NextResponse.json({ trips: [], startOdometer })

  const pairs = drafts.map(t => ({ from: t._from_address, to: t._to_address }))
  let distances: Map<string, number>
  try {
    distances = await getDistances(pairs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Blad Maps API' }, { status: 500 })
  }

  let odo = startOdometer
  const trips = drafts.map(t => {
    const km = distances.get(distanceKey(t._from_address, t._to_address)) ?? 20
    const trip = { vehicle_id: t.vehicle_id, trip_date: t.trip_date, purpose: t.purpose, route_from: t.route_from, route_to: t.route_to, odometer_before: odo, odometer_after: odo + km }
    odo += km
    return trip
  })

  return NextResponse.json({ trips, startOdometer })
}
