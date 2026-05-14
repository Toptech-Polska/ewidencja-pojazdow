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

  // Validate simulation config
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

  const { vehicle_id, startDate, endDate, currentOdometer } = parsed.data

  // Fetch vehicle + last odometer
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
  const targetKm = currentOdometer - startOdometer

  // Validate: currentOdometer must be greater than last recorded odometer
  if (targetKm <= 0) {
    return NextResponse.json({
      code: 'odometer_too_low',
      message: `Podany stan licznika musi byc wiekszy niz ostatni wpis w ewidencji (${startOdometer.toLocaleString('pl-PL')} km).`,
      hint: '',
      startOdometer,
    }, { status: 422 })
  }

  // Fetch all distances between location pairs in one batch
  const pairs: { from: string; to: string }[] = []
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i !== j) pairs.push({ from: locations[i].address, to: locations[j].address })
    }
  }

  let distances: Map<string, number>
  try {
    distances = await getDistances(pairs)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Blad Maps API' }, { status: 500 })
  }

  const drafts = generateTrips({ vehicleId: vehicle_id, startOdometer, targetKm, startDate, endDate, locations }, distances)
  if (drafts.length === 0)
    return NextResponse.json({ error: 'Nie udalo sie wygenerowac wpisow. Sprawdz lokalizacje w profilu.' }, { status: 400 })

  // Strip internal fields before returning
  const trips = drafts.map(({ _from_address, _to_address, ...t }) => t)

  return NextResponse.json({ trips, startOdometer, targetKm })
}
