import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { WpisyClient } from './WpisyClient'

export default async function WpisyPage({
  searchParams,
}: {
  searchParams: { filter?: string; vehicle?: string }
}) {
  const supabase = await createClient()

  // UWAGA: trip_entries ma TRZY foreign keys do vat_km.profiles
  // (driver_id, created_by, confirmed_by). PostgREST przy `profiles(...)`
  // bez aliasu rzuca błąd "more than one relationship was found" i całe
  // zapytanie zwraca null. Dlatego embed JOIN z driver musi być explicit:
  // `driver:profiles!driver_id(full_name)`.
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: vehicles }, { data: trips }, { data: myProfile }] = await Promise.all([
    supabase
      .schema('vat_km')
      .from('vehicles')
      .select('id, plate_number, make, model, status, odometer_start')
      .eq('status', 'aktywny')
      .order('plate_number'),

    supabase
      .schema('vat_km')
      .from('trip_entries')
      .select('*, vehicles(plate_number, make, model), driver:profiles!driver_id(full_name)')
      .order('entry_number', { ascending: false }),

    user
      ? supabase.schema('vat_km').from('profiles').select('default_vehicle_id').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const myDefaultVehicleId = myProfile?.default_vehicle_id ?? null

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ewidencja przebiegu" action={{ label: '+ Nowy wpis', href: '/wpisy/nowy' }} />
      <WpisyClient
        vehicles={vehicles ?? []}
        trips={trips ?? []}
        initialFilter={(searchParams.filter as 'all' | 'pending') ?? 'all'}
        initialVehicle={searchParams.vehicle ?? ''}
        myDefaultVehicleId={myDefaultVehicleId}
      />
    </div>
  )
}
