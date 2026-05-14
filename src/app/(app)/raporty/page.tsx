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
    { data: company },
  ] = await Promise.all([
    supabase.schema('vat_km').from('vehicles').select('id, plate_number, make, model, status').order('plate_number'),
    supabase.schema('vat_km').from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.schema('vat_km').from('v_monthly_summary').select('*'),
    supabase.schema('vat_km').from('companies').select('name, nip').single(),
  ])

  const { data: trips } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .select('*, vehicles(plate_number, make, model)')
    .order('trip_date', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Zestawienia i eksport" />
      <RaportyClient
        vehicles={vehicles ?? []}
        profiles={profiles ?? []}
        trips={trips ?? []}
        summaryAll={summaryAll ?? []}
        ymCurrent={ymCurrent}
        ymPrevious={ymPrevious}
        companyName={company?.name ?? undefined}
        companyNip={company?.nip ?? undefined}
      />
    </div>
  )
}
