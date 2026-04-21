import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { AdminEditProfileForm } from './AdminEditProfileForm'
import { SimulationConfigForm } from '@/app/(app)/profil/SimulationConfigForm'
import type { Profile } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  ksiegowosc:    'Ksiegowosc',
  kierowca:      'Kierowca',
  kontrola:      'Kontrola',
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()
  if (adminProfile?.role !== 'administrator') redirect('/dashboard')

  // Load target profile — must be in same company
  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', adminProfile.company_id)
    .single()

  if (!profile) notFound()

  const showSimulation = ['administrator', 'kierowca'].includes(profile.role)

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`Profil: ${profile.full_name}`} />
      <div className="main-scroll p-5 space-y-5">

        {/* Header karty */}
        <div className="card max-w-lg mx-auto">
          <div className="p-5 border-b border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              {profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{profile.full_name}</p>
              <p className="text-xs text-slate-500">{profile.email} &middot; {ROLE_LABELS[profile.role] ?? profile.role}</p>
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Dane podstawowe</p>
            <AdminEditProfileForm profile={profile as Profile} />
          </div>
        </div>

        {/* Konfiguracja symulacji — widoczna dla kierowcy i administratora */}
        {showSimulation && (
          <div className="card max-w-lg mx-auto">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Konfiguracja symulacji</h2>
              <p className="text-xs text-slate-500 mt-1">
                Lokalizacje i cele wizyt uzywane przez generator wpisow ewidencji.
              </p>
            </div>
            <div className="p-5">
              <SimulationConfigForm
                profileId={profile.id}
                initialConfig={profile.simulation_config ?? null}
              />
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto">
          <a href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
            &larr; Wróc do listy uzytkownikow
          </a>
        </div>

      </div>
    </div>
  )
}
