import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { Vehicle, TripEntry, Vat26ComplianceRow } from '@/types/database'

function Badge({ type, children }: { type: 'ok'|'warn'|'danger'|'info'|'gray', children: React.ReactNode }) {
  return <span className={`badge badge-${type}`}>{children}</span>
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value ${color ?? ''}`}>{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── Fetch all data in parallel ────────────────────────────
  const [
    { data: vehicles },
    { data: trips },
    { data: compliance },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.schema('vat_km').from('vehicles').select('*').order('created_at'),
    supabase.schema('vat_km').from('trip_entries')
      .select('*, vehicles(plate_number, make, model)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.schema('vat_km').from('v_vat26_compliance').select('*'),
    supabase.schema('vat_km').from('trip_entries')
      .select('*', { count: 'exact', head: true })
      .eq('requires_confirmation', true)
      .eq('confirmed_by_company', false),
  ])

  const activeVehicles   = (vehicles ?? []).filter(v => v.status === 'aktywny')
  const vat26Alerts      = (compliance ?? []).filter(c =>
    ['overdue', 'urgent', 'pending', 'no_expense_date'].includes(c.vat26_status ?? '')
  )

  // Km w bieżącym miesiącu
  const now = new Date()
  const ymCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { data: monthlyData } = await supabase
    .schema('vat_km')
    .from('v_monthly_summary')
    .select('total_km')
    .eq('year_month', ymCurrent)

  const kmThisMonth = (monthlyData ?? []).reduce((s, r) => s + (r.total_km ?? 0), 0)

  const monthName = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboard" action={{ label: '+ Nowy wpis', href: '/wpisy/nowy' }} />

      <div className="main-scroll p-5 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Aktywne pojazdy"
            value={activeVehicles.length}
            sub={`${(vehicles ?? []).length - activeVehicles.length} ewidencja zakończona`}
          />
          <KpiCard
            label="Km w tym miesiącu"
            value={kmThisMonth.toLocaleString('pl-PL')}
            sub={monthName}
            color="text-green-700"
          />
          <KpiCard
            label="Do potwierdzenia"
            value={pendingCount ?? 0}
            sub="wpisy kierowców zewn."
            color={(pendingCount ?? 0) > 0 ? 'text-amber-600' : ''}
          />
          <KpiCard
            label="Alerty VAT-26"
            value={vat26Alerts.length}
            sub="wymagają działania"
            color={vat26Alerts.length > 0 ? 'text-red-600' : ''}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                </tr>
              </thead>
              <tbody>
                {(vehicles ?? []).map(v => (
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
                  </tr>
                ))}
                {!vehicles?.length && (
                  <tr><td colSpan={3} className="text-center text-slate-400 py-6 text-sm">Brak pojazdów — <Link href="/pojazdy/nowy" className="text-blue-600">dodaj pierwszy</Link></td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Alerty compliance */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Alerty compliance</span>
              <Link href="/compliance" className="text-xs text-blue-600 hover:text-blue-800">Szczegóły →</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {vat26Alerts.map(c => (
                <div key={c.id} className="flex gap-3 p-3"
                     style={{ borderLeft: `3px solid ${c.vat26_status === 'overdue' ? '#ef4444' : '#f59e0b'}` }}>
                  <div className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs
                    ${c.vat26_status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    {c.vat26_status === 'overdue' ? '!' : '⚠'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{c.plate_number} — {c.make} {c.model}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.vat26_status === 'overdue'
                        ? `Po terminie! Termin był: ${c.vat26_deadline}`
                        : `Termin: ${c.vat26_deadline} · Pozostało: ${c.days_until_deadline} dni`}
                    </p>
                    <Link href="/compliance" className="text-xs text-blue-600 mt-1 inline-block">Przejdź do VAT-26 →</Link>
                  </div>
                </div>
              ))}
              {(pendingCount ?? 0) > 0 && (
                <div className="flex gap-3 p-3" style={{ borderLeft: '3px solid #f59e0b' }}>
                  <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs bg-amber-50 text-amber-600">⚠</div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-900">{pendingCount} wpisów wymaga potwierdzenia</p>
                    <p className="text-xs text-slate-500 mt-0.5">Kierowcy zewnętrzni · art. 86a ust. 7 pkt 2</p>
                    <Link href="/wpisy?filter=pending" className="text-xs text-blue-600 mt-1 inline-block">Zatwierdź wpisy →</Link>
                  </div>
                </div>
              )}
              {vat26Alerts.length === 0 && (pendingCount ?? 0) === 0 && (
                <div className="flex gap-3 p-3" style={{ borderLeft: '3px solid #10b981' }}>
                  <div className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-xs bg-green-50 text-green-600">✓</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Wszystko w porządku</p>
                    <p className="text-xs text-slate-500 mt-0.5">Brak aktywnych alertów compliance</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ostatnie wpisy */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Ostatnie wpisy ewidencji</span>
            <Link href="/wpisy" className="text-xs text-blue-600 hover:text-blue-800">Wszystkie →</Link>
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
                        {t.driver_name_external ?? '—'}
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
