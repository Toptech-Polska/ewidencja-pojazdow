import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { FiledVat26Button } from '../../../(app)/compliance/FiledVat26Button'
import { CloseRecordButton } from './CloseRecordButton'

interface Props {
  params: { id: string }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  aktywny:          { label: 'Aktywny',               cls: 'badge-ok'   },
  zakonczony:       { label: 'Zakończony',             cls: 'badge-gray' },
  zmieniony_sposob: { label: 'Zmieniony sposób użytk.', cls: 'badge-warn' },
}

export default async function PojazPage({ params }: Props) {
  const supabase = await createClient()

  // Pobierz pojazd
  const { data: vehicle, error } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !vehicle) notFound()

  // Pobierz wpisy i statystyki równolegle
  const now = new Date()
  const ymCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [
    { data: trips },
    { data: monthlyStats },
    { data: compliance },
  ] = await Promise.all([
    supabase
      .schema('vat_km')
      .from('trip_entries')
      .select('*, profiles(full_name)')
      .eq('vehicle_id', params.id)
      .order('entry_number', { ascending: false })
      .limit(50),
    supabase
      .schema('vat_km')
      .from('v_monthly_summary')
      .select('*')
      .eq('vehicle_id', params.id)
      .eq('year_month', ymCurrent)
      .single(),
    supabase
      .schema('vat_km')
      .from('v_vat26_compliance')
      .select('*')
      .eq('id', params.id)
      .single(),
  ])

  const allTrips     = trips ?? []
  const totalKm      = allTrips.reduce((s, t) => s + (t.kilometers ?? 0), 0)
  const kmThisMonth  = monthlyStats?.total_km ?? 0
  const pendingCount = allTrips.filter(t => t.requires_confirmation && !t.confirmed_by_company).length
  const statusCfg    = STATUS_LABEL[vehicle.status] ?? STATUS_LABEL.aktywny
  const vat26        = compliance

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={`${vehicle.plate_number} — ${vehicle.make} ${vehicle.model}`}
        action={{ label: '+ Nowy wpis', href: `/wpisy/nowy?vehicle=${params.id}` }}
      />

      <div className="main-scroll p-5 space-y-4">

        {/* ── Nagłówek pojazdu ─────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">◈</div>
              <div>
                <p className="font-mono text-2xl font-bold text-slate-900 tracking-widest">{vehicle.plate_number}</p>
                <p className="text-slate-500 mt-0.5">{vehicle.make} {vehicle.model}</p>
                {vehicle.vin && (
                  <p className="font-mono text-xs text-slate-400 mt-0.5">VIN: {vehicle.vin}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`badge ${statusCfg.cls}`}>{statusCfg.label}</span>
              {vehicle.status === 'aktywny' && (
                <CloseRecordButton
                  vehicleId={vehicle.id}
                  plateNumber={vehicle.plate_number}
                  odometerStart={vehicle.odometer_start}
                />
              )}
            </div>
          </div>

          {/* Dane szczegółowe */}
          <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Ewidencja od</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {new Date(vehicle.record_start_date).toLocaleDateString('pl-PL')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Licznik startowy</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {vehicle.odometer_start.toLocaleString('pl-PL')} km
              </p>
            </div>
            {vehicle.record_end_date && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Ewidencja do</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {new Date(vehicle.record_end_date).toLocaleDateString('pl-PL')}
                </p>
              </div>
            )}
            {vehicle.odometer_end && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Licznik końcowy</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {vehicle.odometer_end.toLocaleString('pl-PL')} km
                </p>
              </div>
            )}
            {vehicle.notes && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Notatki</p>
                <p className="text-sm text-slate-600 mt-0.5">{vehicle.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <div className="kpi-card">
            <p className="kpi-label">Km łącznie</p>
            <p className="kpi-value text-blue-700">{totalKm.toLocaleString('pl-PL')}</p>
            <p className="kpi-sub">od początku ewidencji</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Km w tym miesiącu</p>
            <p className="kpi-value text-green-700">{kmThisMonth.toLocaleString('pl-PL')}</p>
            <p className="kpi-sub">{now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Liczba wpisów</p>
            <p className="kpi-value">{allTrips.length}</p>
            <p className="kpi-sub">łącznie</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Do potwierdzenia</p>
            <p className={`kpi-value ${pendingCount > 0 ? 'text-amber-600' : ''}`}>{pendingCount}</p>
            <p className="kpi-sub">wpisy zewnętrzne</p>
          </div>
        </div>

        {/* ── VAT-26 ───────────────────────────────────────── */}
        {vehicle.vat26_required && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-slate-900 text-sm">Status VAT-26</p>
              <Link href="/compliance" className="text-xs text-blue-600 hover:text-blue-800">
                Centrum compliance →
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {vehicle.vat26_filed ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 font-bold">✓</div>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Złożony</p>
                    <p className="text-xs text-slate-500">
                      {vehicle.vat26_filed_date
                        ? new Date(vehicle.vat26_filed_date).toLocaleDateString('pl-PL')
                        : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                    ${vat26?.vat26_status === 'overdue' || vat26?.vat26_status === 'urgent'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'}`}>
                    {vat26?.vat26_status === 'overdue' ? '!' : '⚠'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {vat26?.vat26_status === 'overdue' ? 'Po terminie!' :
                       vat26?.vat26_status === 'urgent'  ? `Termin za ${vat26.days_until_deadline} dni` :
                       vat26?.vat26_status === 'no_expense_date' ? 'Brak daty pierwszego wydatku' :
                       'Oczekujący'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {vehicle.vat26_first_expense_date
                        ? `Pierwszy wydatek: ${new Date(vehicle.vat26_first_expense_date).toLocaleDateString('pl-PL')}`
                        : 'Data pierwszego wydatku nie jest ustawiona'}
                      {vehicle.vat26_deadline && ` · Termin: ${new Date(vehicle.vat26_deadline).toLocaleDateString('pl-PL')}`}
                    </p>
                  </div>
                  {vehicle.status === 'aktywny' && (
                    <FiledVat26Button vehicleId={vehicle.id} plateNumber={vehicle.plate_number} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Historia wpisów ──────────────────────────────── */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Historia wpisów</span>
            <Link href={`/wpisy?vehicle=${params.id}`} className="text-xs text-blue-600 hover:text-blue-800">
              Wszystkie →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-max">
              <thead>
                <tr>
                  <th>Nr</th>
                  <th>Data</th>
                  <th>Cel wyjazdu</th>
                  <th>Skąd → Dokąd</th>
                  <th>Km</th>
                  <th>Licznik</th>
                  <th>Kierowca</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allTrips.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-400 py-10 text-sm">
                      Brak wpisów —{' '}
                      <Link href={`/wpisy/nowy?vehicle=${params.id}`} className="text-blue-600">
                        dodaj pierwszy
                      </Link>
                    </td>
                  </tr>
                )}
                {allTrips.map(t => {
                  const needsConfirm = t.requires_confirmation && !t.confirmed_by_company
                  const driver = t.driver_name_external
                    ? <>{t.driver_name_external} <span className="text-amber-600 text-xs">(zewn.)</span></>
                    : ((t.profiles as any)?.full_name ?? '—')
                  return (
                    <tr key={t.id} className={needsConfirm ? 'bg-amber-50/40' : ''}>
                      <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>
                      <td className="text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(t.trip_date).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="text-xs max-w-xs">
                        {t.purpose.length > 45 ? t.purpose.slice(0, 43) + '…' : t.purpose}
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {t.route_from.split(',')[0]} → {t.route_to.split(',')[0]}
                      </td>
                      <td className="font-bold whitespace-nowrap tabular-nums">
                        {(t.kilometers ?? t.odometer_after - t.odometer_before)} km
                      </td>
                      <td className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {t.odometer_before.toLocaleString('pl-PL')} → {t.odometer_after.toLocaleString('pl-PL')}
                      </td>
                      <td className="text-xs text-slate-600 whitespace-nowrap">{driver}</td>
                      <td>
                        {needsConfirm
                          ? <span className="badge badge-warn">Do potwierdz.</span>
                          : <span className="badge badge-ok">OK</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {allTrips.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between text-xs text-slate-500">
              <span>Pokazano <strong className="text-slate-700">{allTrips.length}</strong> ostatnich wpisów</span>
              <span>Suma km: <strong className="text-green-700 tabular-nums">{totalKm.toLocaleString('pl-PL')} km</strong></span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
