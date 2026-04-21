import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SimulationSchema } from '@/lib/validations/simulation'
import { generateTrips } from '@/lib/simulation/generate'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()
  if (!profile || !['administrator', 'kierowca'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnien' }, { status: 403 })

  const body = await req.json()
  const parsed = SimulationSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { vehicle_id, startDate, endDate, tripsPerWeek, avgKmPerTrip } = parsed.data

  const { data: vehicle } = await supabase
    .schema('vat_km').from('vehicles')
    .select('id, odometer_start, company_id')
    .eq('id', vehicle_id).eq('company_id', profile.company_id).single()
  if (!vehicle) return NextResponse.json({ error: 'Pojazd nie istnieje lub brak dostepu' }, { status: 404 })

  const { data: lastEntry } = await supabase
    .schema('vat_km').from('trip_entries')
    .select('odometer_after').eq('vehicle_id', vehicle_id)
    .order('entry_number', { ascending: false }).limit(1).single()

  const startOdometer = lastEntry?.odometer_after ?? vehicle.odometer_start
  const trips = generateTrips({ vehicleId: vehicle_id, startOdometer, startDate, endDate, tripsPerWeek, avgKmPerTrip })

  return NextResponse.json({ trips, startOdometer })
}
