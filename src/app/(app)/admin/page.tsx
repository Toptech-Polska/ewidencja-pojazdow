import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchWhitelist, isCurrentUserGlobalAdmin } from '@/lib/auth_hub'
import { Topbar } from '@/components/layout/Topbar'
import { AdminUsersClient } from './AdminUsersClient'
import { WhitelistManager } from './WhitelistManager'
import type { UserRole, Profile } from '@/types/database'

const PERMS_MATRIX = [
  { action: 'Dodaj / edytuj własne wpisy',              administrator: 'tak', ksiegowosc: 'tak', kierowca: 'własne', kontrola: 'nie' },
  { action: 'Zatwierdź wpisy kierowców zewnętrznych',   administrator: 'tak', ksiegowosc: 'tak', kierowca: 'nie',    kontrola: 'nie' },
  { action: 'Zarządzaj pojazdami',                      administrator: 'tak', ksiegowosc: 'nie', kierowca: 'nie',    kontrola: 'nie' },
  { action: 'Raporty i eksport PDF / CSV',              administrator: 'tak', ksiegowosc: 'tak', kierowca: 'nie',    kontrola: 'tak' },
  { action: 'Compliance / VAT-26 — odczyt',             administrator: 'tak', ksiegowosc: 'tak', kierowca: 'nie',    kontrola: 'tak' },
  { action: 'Compliance / VAT-26 — oznacz złożony',     administrator: 'tak', ksiegowosc: 'tak', kierowca: 'nie',    kontrola: 'nie' },
  { action: 'Historia zmian (audit log)',               administrator: 'tak', ksiegowosc: 'tak', kierowca: 'nie',    kontrola: 'tak' },
  { action: 'Zarządzaj użytkownikami',                  administrator: 'tak', ksiegowosc: 'nie', kierowca: 'nie',    kontrola: 'nie' },
]

function PermBadge({ val }: { val: string }) {
  if (val === 'tak')    return <span className="badge badge-ok">Tak</span>
  if (val === 'nie')    return <span className="badge badge-gray">Nie</span>
  if (val === 'własne') return <span className="badge badge-info">Tylko własne</span>
  if (val === 'odczyt') return <span className="badge badge-info">Odczyt</span>
  return <span className="badge badge-gray">{val}</span>
}

export default async function AdminPage() {
  const supabase = await createClient()

  // Guard: tylko administrator (vat_km) z role_assigned=true może wejść
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('role, role_assigned')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'administrator' || currentProfile?.role_assigned !== true) {
    redirect('/dashboard')
  }

  // Profile zalogowanych userów (włącznie z pendingami — tymi co się zalogowali,
  // ale jeszcze nie mają nadanej roli)
  const { data: profiles } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('id, full_name, email, role, is_active, role_assigned, created_at, company_id, simulation_config')
    .order('role_assigned', { ascending: true })  // pendingi na górze
    .order('full_name')

  // auth_hub jest niedostępny przez REST (schema not exposed) — fetch przez
  // helper, który używa admin klienta i sprawdza uprawnienia przez RPC.
  // Równoległe pobranie obu wartości.
  const [whitelist, isGlobalAdmin] = await Promise.all([
    fetchWhitelist(),
    isCurrentUserGlobalAdmin(),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Administracja — użytkownicy" />

      <div className="main-scroll p-5 space-y-4">
        {/* Whitelist (Auth Hub) */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Whitelist Auth Hub</span>
          </div>
          <WhitelistManager
            whitelist={whitelist}
            isGlobalAdmin={isGlobalAdmin}
          />
        </div>

        {/* Users list */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Użytkownicy aplikacji</span>
          </div>
          <AdminUsersClient profiles={(profiles ?? []) as Profile[]} />
        </div>

        {/* Permissions matrix */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Macierz uprawnień ról</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Akcja</th>
                  <th>Administrator</th>
                  <th>Księgowość</th>
                  <th>Kierowca</th>
                  <th>Kontrola</th>
                </tr>
              </thead>
              <tbody>
                {PERMS_MATRIX.map(row => (
                  <tr key={row.action}>
                    <td>{row.action}</td>
                    <td><PermBadge val={row.administrator} /></td>
                    <td><PermBadge val={row.ksiegowosc} /></td>
                    <td><PermBadge val={row.kierowca} /></td>
                    <td><PermBadge val={row.kontrola} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
