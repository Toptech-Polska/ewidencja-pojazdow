import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import type { UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  ksiegowosc:    'Księgowość',
  kierowca:      'Kierowca',
  kontrola:      'Kontrola',
}
const ROLE_BADGE: Record<UserRole, string> = {
  administrator: 'badge-info',
  ksiegowosc:    'badge-warn',
  kierowca:      'badge-gray',
  kontrola:      'badge-info',
}
const ROLE_PERMS: Record<UserRole, string> = {
  administrator: 'Pełny dostęp do systemu',
  ksiegowosc:    'Raporty, VAT-26, zatwierdzanie, eksport',
  kierowca:      'Własne wpisy ewidencji',
  kontrola:      'Odczyt, eksport, historia zmian',
}

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

  const { data: profiles } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('*')
    .order('full_name')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Administracja — użytkownicy" />

      <div className="main-scroll p-5 space-y-4">
        {/* Users list */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Użytkownicy systemu</span>
            <button className="btn-primary text-xs py-1.5 px-3">+ Dodaj użytkownika</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Użytkownik</th><th>Email</th><th>Rola</th>
                <th>Uprawnienia</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map(p => {
                const initials = p.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-semibold text-slate-800">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 text-xs">{p.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[p.role as UserRole]}`}>{ROLE_LABELS[p.role as UserRole]}</span></td>
                    <td className="text-xs text-slate-500">{ROLE_PERMS[p.role as UserRole]}</td>
                    <td>
                      {p.is_active
                        ? <span className="badge badge-ok">Aktywny</span>
                        : <span className="badge badge-gray">Nieaktywny</span>
                      }
                    </td>
                    <td>
                      <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edytuj</button>
                    </td>
                  </tr>
                )
              })}
              {!profiles?.length && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-6 text-sm">Brak użytkowników</td></tr>
              )}
            </tbody>
          </table>
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
