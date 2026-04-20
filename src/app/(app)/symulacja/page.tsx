import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { SimulacjaForm } from './SimulacjaForm'
import type { Vehicle } from '@/types/database'

export default async function SymulacjaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()

  if (!profile || !['administrator', 'kierowca'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: vehicles } = await supabase
    .schema('vat_km').from('vehicles')
    .select('id, plate_number, make, model, odometer_start')
    .eq('company_id', profile.company_id)
    .eq('status', 'aktywny')
    .order('plate_number')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Symulacja wpisów ewidencji" />
      <div className="main-scroll p-5">
        <div className="card max-w-2xl mx-auto">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Generator wpisów</h2>
            <p className="text-xs text-slate-500 mt-1">
              Automatycznie wypełni ewidencję wpisami dla wybranego pojazdu w zadanym przedziale dat.
              Wpisy są generowane deterministycznie i spełniają wymóg ciągłości licznika.
            </p>
          </div>
          <SimulacjaForm vehicles={(vehicles ?? []) as Vehicle[]} />
        </div>
      </div>
    </div>
  )
}
