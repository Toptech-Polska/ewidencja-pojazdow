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

  const [{ data: vehicles }, { data: trips }] = await Promise.all([
    supabase
      .schema('vat_km')
      .from('vehicles')
      .select('id, plate_number, make, model, status, odometer_start')
      .eq('status', 'aktywny')
      .order('plate_number'),

    supabase
      .schema('vat_km')
      .from('trip_entries')
      .select('*, vehicles(plate_number, make, model), profiles(full_name)')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ewidencja przebiegu" action={{ label: '+ Nowy wpis', href: '/wpisy/nowy' }} />
      <WpisyClient
        vehicles={vehicles ?? []}
        trips={trips ?? []}
        initialFilter={(searchParams.filter as 'all' | 'pending') ?? 'all'}
        initialVehicle={searchParams.vehicle ?? ''}
      />
    </div>
  )
}
