import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import type { Vehicle, TripEntry } from '@/types/database'

function Badge({ type, children }: { type: 'ok'|'warn'|'danger'|'info'|'gray', children: React.ReactNode }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

function KpiCard({ label, value, sub, color, valueClassName }: { label: string; value: number | string; sub?: string; color?: string; valueClassName?: string }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value ${color ?? ''} ${valueClassName ?? ''}`}>{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  )
}

function PendingRoleScreen({ fullName, isInactive }: { fullName: string; isInactive: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Witamy w ewidencji pojazdów" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-lg w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 mx-auto flex items-center justify-center text-amber-600 text-xl">
            ⏳
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isInactive ? 'Konto wyłączone' : 'Oczekujesz na nadanie roli'}
          </h2>
          {isInactive ? (
            <p className="text-sm text-slate-600">
              Cześć {fullName}! Twoje konto zostało wyłączone przez administratora.
              Skontaktuj się z administratorem, aby przywrócić dostęp.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Cześć {fullName}! Twoje konto zostało utworzone, ale administrator musi
              jeszcze nadać Ci rolę w aplikacji. Po jej nadaniu zobaczysz panel
              ewidencji pojazdów. Sprawdź ponownie za chwilę lub skontaktuj się
              z administratorem.
            </p>
          )}
          <div className="text-xs text-slate-400 pt-2">
            Status zostanie odświeżony po przeładowaniu strony.
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: statusRows } = await supabase
    .schema('vat_km')
    .rpc('my_onboarding_status')

  const status = statusRows?.[0]

  if (!status?.has_profile || !status.role_assigned || status.is_active === false) {
    return (
      <PendingRoleScreen
        fullName={status?.full_name ?? user?.email ?? 'użytkowniku'}
        isInactive={status?.is_active === false}
      />
    )
  }

  // ── Standardowy dashboard ───────────────────────────────────────────────────

  // Fetch user's default vehicle (needed to scope the trip entries table)
  let myDefaultVehicleId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .schema('vat_km').from('profiles')
      .select('default_vehicle_id').eq('id', user.id).single()
    myDefaultVehicleId = profile?.default_vehicle_id ?? null
  }

  let tripsQuery = supabase.schema('vat_km').from('trip_entries')
    .select('*, vehicles(plate_number, make, model), driver:profiles!driver_id(full_name)')
    .order('entry_number', { ascending: false })
    .limit(8)
  if (myDefaultVehicleId) {
    tripsQuery = tripsQuery.eq('vehicle_id', myDefaultVehicleId)
  }

  const [
    { data: vehicles },
    { data: trips },
    { data: lastEntryRows },
  ] = await Promise.all([
    supabase.schema('vat_km').from('vehicles').select('*').order('created_at'),
    tripsQuery,
    supabase.schema('vat_km').from('trip_entries')
      .select('vehicle_id, trip_date')
      .order('trip_date', { ascending: false }),
  ])

  // vehicle_id -> last trip_date (one pass, no N+1)
  const lastEntryMap = new Map<string, string>()
  for (const row of lastEntryRows ?? []) {
    if (!lastEntryMap.has(row.vehicle_id)) {
      lastEntryMap.set(row.vehicle_id, row.trip_date)
    }
  }

  const myVehicle = myDefaultVehicleId
    ? ((vehicles ?? []).find(v => v.id === myDefaultVehicleId) ?? null)
    : null

  const myDefaultVehiclePlate = myVehicle?.plate_number ?? null

  // Most recent odometer: trips are ordered entry_number desc, so trips[0] is the latest
  const myOdometer: number = trips?.[0]?.odometer_after ?? myVehicle?.odometer_start ?? 0

  const activeVehicles = (vehicles ?? []).filter(v => v.status === 'aktywny')

  const now = new Date()
  const ymCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  let monthlyQuery = supabase
    .schema('vat_km')
    .from('v_monthly_summary')
    .select('total_km')
    .eq('year_month', ymCurrent)
  if (myDefaultVehicleId) {
    monthlyQuery = monthlyQuery.eq('vehicle_id', myDefaultVehicleId)
  }
  const { data: monthlyData } = await monthlyQuery

  const kmThisMonth = (monthlyData ?? []).reduce((s, r) => s + (r.total_km ?? 0), 0)
  const monthName = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  function daysSince(tripDateStr: string): number {
    return Math.floor(
      (todayMidnight.getTime() - new Date(tripDateStr + 'T00:00:00').getTime()) / 86400000
    )
  }
  function fmtDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pl-PL')
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" action={{ label: '+ Nowy wpis', href: '/wpisy/nowy' }} />

      <div className="main-scroll p-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3">
          {myVehicle ? (
            <KpiCard
              label="Twój pojazd"
              value={myVehicle.plate_number}
              sub={`${myVehicle.make} ${myVehicle.model} · ${myOdometer.toLocaleString('pl-PL')} km`}
              valueClassName="font-mono text-xl"
            />
          ) : (
            <KpiCard
              label="Aktywne pojazdy"
              value={activeVehicles.length}
              sub={`${(vehicles ?? []).length - activeVehicles.length} ewidencja zakończona`}
            />
          )}
          <KpiCard
            label="Km w tym miesiącu"
            value={kmThisMonth.toLocaleString('pl-PL')}
            sub={monthName}
            color="text-green-700"
          />
        </div>

        {/* Status pojazdów */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Status pojazdów</span>
            <Link href="/pojazdy" className="text-xs text-blue-600 hover:text-blue-800">Wszystkie →</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tablica</th>
                <th>Pojazd</th>
                <th>Status</th>
                <th>Ostatni wpis</th>
              </tr>
            </thead>
            <tbody>
              {(vehicles ?? []).map(v => {
                const lastDate = lastEntryMap.get(v.id) ?? null
                const isActive = v.status === 'aktywny'
                const days = lastDate ? daysSince(lastDate) : null

                let lastEntryCell
                if (!isActive) {
                  lastEntryCell = lastDate
                    ? <span className="text-xs text-slate-500">{fmtDate(lastDate)}</span>
                    : <span className="text-xs text-slate-400">—</span>
                } else if (!lastDate) {
                  lastEntryCell = (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">brak wpisów</span>
                      <Link href={`/wpisy/nowy?vehicle=${v.id}`} className="badge badge-danger">UZUPEŁNIJ</Link>
                    </div>
                  )
                } else if (days! <= 14) {
                  lastEntryCell = <span className="text-xs text-slate-500">{fmtDate(lastDate)}</span>
                } else if (days! <= 28) {
                  lastEntryCell = (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{fmtDate(lastDate)}</span>
                      <Badge type="warn">{days} dni temu</Badge>
                    </div>
                  )
                } else {
                  lastEntryCell = (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{fmtDate(lastDate)}</span>
                      <Link href={`/wpisy/nowy?vehicle=${v.id}`} className="badge badge-danger">UZUPEŁNIJ</Link>
                    </div>
                  )
                }

                return (
                  <tr key={v.id} className="cursor-pointer hover:bg-slate-50">
                    <td>
                      <Link href={`/pojazdy/${v.id}`} className="font-mono font-bold text-slate-900 text-xs">
                        {v.plate_number}
                      </Link>
                    </td>
                    <td className="text-slate-500">{v.make} {v.model.split(' ')[0]}</td>
                    <td>
                      {v.status === 'aktywny' && v.vat26_filed && <Badge type="ok">Aktywny</Badge>}
                      {v.status === 'aktywny' && !v.vat26_filed && v.vat26_required && <Badge type="warn">Brak VAT-26</Badge>}
                      {v.status === 'aktywny' && !v.vat26_required && <Badge type="ok">Aktywny</Badge>}
                      {v.status === 'zakonczony' && <Badge type="gray">Zakończony</Badge>}
                      {v.status === 'zmieniony_sposob' && <Badge type="warn">Zmieniony sposób</Badge>}
                    </td>
                    <td>{lastEntryCell}</td>
                  </tr>
                )
              })}
              {!vehicles?.length && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6 text-sm">Brak pojazdów — <Link href="/pojazdy/nowy" className="text-blue-600">dodaj pierwszy</Link></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ostatnie wpisy */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">
              Ostatnie wpisy ewidencji{myDefaultVehiclePlate && ` — ${myDefaultVehiclePlate}`}
            </span>
            <Link
              href={myDefaultVehicleId ? `/wpisy?vehicle=${myDefaultVehicleId}` : '/wpisy'}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Wszystkie →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-max">
              <thead>
                <tr>
                  <th>Nr</th><th>Data</th><th>Pojazd</th>
                  <th>Cel wyjazdu</th><th>Trasa</th>
                  <th>Km</th><th>Kierowca</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(trips ?? []).map(t => {
                  const veh = t.vehicles as any
                  const purpose = t.purpose.length > 40 ? t.purpose.slice(0, 38) + '…' : t.purpose
                  return (
                    <tr key={t.id}>
                      <td className="font-bold text-slate-900">{t.entry_number}</td>
                      <td className="text-slate-500 whitespace-nowrap">{new Date(t.trip_date).toLocaleDateString('pl-PL')}</td>
                      <td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{veh?.plate_number}</span></td>
                      <td className="max-w-xs">{purpose}</td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{t.route_from.split(',')[0]} → {t.route_to.split(',')[0]}</td>
                      <td className="font-semibold whitespace-nowrap">{t.kilometers ?? t.odometer_after - t.odometer_before} km</td>
                      <td className="text-slate-600 whitespace-nowrap">
                        {t.driver_name_external ?? (t.driver as any)?.full_name ?? '—'}
                      </td>
                      <td>
                        {t.confirmed_by_company || !t.requires_confirmation
                          ? <Badge type="ok">OK</Badge>
                          : <Badge type="warn">Do potwierdz.</Badge>}
                      </td>
                    </tr>
                  )
                })}
                {!trips?.length && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-6 text-sm">Brak wpisów</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
