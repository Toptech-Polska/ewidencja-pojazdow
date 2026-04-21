import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { ProfilForm } from './ProfilForm'
import { SimulationConfigForm } from './SimulationConfigForm'
import type { Profile } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  ksiegowosc:    'Ksiegowosc',
  kierowca:      'Kierowca',
  kontrola:      'Kontrola',
}

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('*').eq('id', user.id).single()

  if (!profile) redirect('/login')

  const showSimulation = ['administrator', 'kierowca'].includes(profile.role)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Moj profil" />
      <div className="main-scroll p-5 space-y-5">

        {/* Dane profilu */}
        <div className="card max-w-lg mx-auto">
          <div className="p-5 border-b border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              {profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{profile.full_name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role] ?? profile.role}</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            <div>
              <p className="form-label">Email</p>
              <p className="text-sm text-slate-700">{profile.email}</p>
            </div>
            <div>
              <p className="form-label">Rola</p>
              <p className="text-sm text-slate-700">{ROLE_LABELS[profile.role] ?? profile.role}</p>
            </div>
            <div>
              <p className="form-label">Konto aktywne od</p>
              <p className="text-sm text-slate-700">
                {new Date(profile.created_at).toLocaleDateString('pl-PL', { dateStyle: 'long' })}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edycja danych</p>
            <ProfilForm profile={profile as Profile} />
          </div>
        </div>

        {/* Konfiguracja symulacji — tylko kierowca i administrator */}
        {showSimulation && (
          <div className="card max-w-lg mx-auto">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Konfiguracja symulacji</h2>
              <p className="text-xs text-slate-500 mt-1">
                Lokalizacje uzywane przez generator wpisow ewidencji. Odleglosci sa obliczane przez Google Maps.
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

      </div>
    </div>
  )
}
