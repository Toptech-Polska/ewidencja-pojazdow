import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { RaportyClient } from './RaportyClient'

export default async function RaportyPage() {
  const supabase = await createClient()

  const now = new Date()
  const ymCurrent  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonth  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ymPrevious = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: vehicles },
    { data: profiles },
    { data: summaryAll },
  ] = await Promise.all([
    supabase.schema('vat_km').from('vehicles')
      .select('id, plate_number, make, model, status, company:companies(name, nip, krs, regon, address)')
      .order('plate_number'),
    supabase.schema('vat_km').from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.schema('vat_km').from('v_monthly_summary').select('*'),
  ])

  // UWAGA: trip_entries ma 3 FK do profiles (driver_id, created_by, confirmed_by).
  // Bez explicit aliasu PostgREST rzuca "more than one relationship" — używamy !driver_id.
  const { data: trips } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .select('*, vehicles(plate_number, make, model), driver:profiles!driver_id(full_name)')
    .order('entry_number', { ascending: true })

  // Mapa vehicleId → dane firmy
  const vehicleCompanies: Record<string, { name: string; nip: string; krs: string | null; regon: string | null; address: string | null }> = {}
  for (const v of vehicles ?? []) {
    if (v.company) {
      vehicleCompanies[v.id] = v.company as unknown as { name: string; nip: string; krs: string | null; regon: string | null; address: string | null }
    }
  }

  const vehiclesForClient = (vehicles ?? []).map(({ company: _c, ...v }) => v)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Zestawienia i eksport" />
      <RaportyClient
        vehicles={vehiclesForClient}
        profiles={profiles ?? []}
        trips={trips ?? []}
        summaryAll={summaryAll ?? []}
        ymCurrent={ymCurrent}
        ymPrevious={ymPrevious}
        vehicleCompanies={vehicleCompanies}
      />
    </div>
  )
}
