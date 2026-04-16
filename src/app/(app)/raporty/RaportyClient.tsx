'use client'

import { useState, useMemo } from 'react'
import type { MonthlySummaryRow } from '@/types/database'

interface Props {
  vehicles:    { id: string; plate_number: string; make: string; model: string; status: string }[]
  profiles:    { id: string; full_name: string }[]
  trips:       any[]
  summaryAll:  MonthlySummaryRow[]
  ymCurrent:   string
  ymPrevious:  string
}

export function RaportyClient({ vehicles, profiles, trips, summaryAll, ymCurrent, ymPrevious }: Props) {
  const [period, setPeriod]       = useState<'current' | 'previous' | 'custom'>('current')
  const [dateFrom, setDateFrom]   = useState(ymCurrent + '-01')
  const [dateTo, setDateTo]       = useState(ymCurrent + '-30')
  const [selVid, setSelVid]       = useState('')
  const [selDriver, setSelDriver] = useState('')

  const drivers = useMemo(() => [...new Set(trips.map((t: any) => t.driver_name_external ?? t.profiles?.full_name).filter(Boolean))].sort(), [trips])

  function periodLabel() {
    if (period === 'current')  return formatYm(ymCurrent)
    if (period === 'previous') return formatYm(ymPrevious)
    return `${dateFrom} – ${dateTo}`
  }

  function formatYm(ym: string) {
    const [y, m] = ym.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
  }

  const filtered = useMemo(() => {
    return trips.filter((t: any) => {
      const d = new Date(t.trip_date)
      let from: Date, to: Date
      if (period === 'current') {
        const [y, m] = ymCurrent.split('-')
        from = new Date(Number(y), Number(m) - 1, 1)
        to   = new Date(Number(y), Number(m), 0)
      } else if (period === 'previous') {
        const [y, m] = ymPrevious.split('-')
        from = new Date(Number(y), Number(m) - 1, 1)
        to   = new Date(Number(y), Number(m), 0)
      } else {
        from = new Date(dateFrom)
        to   = new Date(dateTo)
      }
      if (d < from || d > to) return false
      if (selVid    && t.vehicle_id !== selVid)    return false
      if (selDriver && (t.driver_name_external ?? t.profiles?.full_name) !== selDriver) return false
      return true
    })
  }, [trips, period, dateFrom, dateTo, selVid, selDriver, ymCurrent, ymPrevious])

  const totalKm      = filtered.reduce((s: number, t: any) => s + ((t.kilometers ?? 0)), 0)
  const uniqueVids   = [...new Set(filtered.map((t: any) => t.vehicle_id))].length
  const uniqueDrivers = [...new Set(filtered.map((t: any) => t.driver_name_external ?? t.profiles?.full_name).filter(Boolean))].length

  const activeChips = [
    { id: 'period', label: periodLabel(), removable: false },
    selVid    && { id: 'veh',    label: vehicles.find(v => v.id === selVid)?.plate_number ?? '', removable: true, clear: () => setSelVid('') },
    selDriver && { id: 'driver', label: selDriver, removable: true, clear: () => setSelDriver('') },
  ].filter(Boolean) as { id: string; label: string; removable: boolean; clear?: () => void }[]

  function exportCsv() {
    const rows = [
      ['Nr', 'Data', 'Pojazd', 'Cel wyjazdu', 'Skąd', 'Dokąd', 'Km', 'Kierowca', 'Status'],
      ...filtered.map((t: any) => [
        t.entry_number,
        t.trip_date,
        t.vehicles?.plate_number ?? '',
        t.purpose,
        t.route_from,
        t.route_to,
        t.kilometers ?? '',
        t.driver_name_external ?? '',
        t.confirmed_by_company || !t.requires_confirmation ? 'OK' : 'Do potwierdzenia',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ewidencja-km_${periodLabel().replace(/ /g, '_')}.csv`
    a.click()
  }

  return (
    <div className="main-scroll p-5 space-y-4">
      {/* Filter bar */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtry zestawienia</span>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 text-slate-600 font-medium">
              ↓ CSV
            </button>
            <button className="text-xs px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">
              ↓ PDF
            </button>
          </div>
        </div>

        <div className="px-4 py-3.5 flex flex-wrap gap-x-5 gap-y-3 items-end">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Okres</p>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              {[
                { id: 'current' as const, label: 'Ten miesiąc' },
                { id: 'previous' as const, label: 'Poprzedni mies.' },
                { id: 'custom' as const, label: 'Zakres własny' },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setPeriod(id)}
                  className={`px-3 py-2 border-r border-slate-200 last:border-r-0 transition-colors ${
                    period === id ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-blue-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-end gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Od</p>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
              <span className="text-slate-300 pb-2.5 text-lg">→</span>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Do</p>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
              </div>
            </div>
          )}

          <div className="hidden lg:block w-px self-stretch bg-slate-200" />

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Pojazd</p>
            <select value={selVid} onChange={e => setSelVid(e.target.value)}
              className={`border rounded-lg px-3 py-2 text-sm bg-white min-w-48 ${selVid ? 'border-blue-400' : 'border-slate-200'}`}>
              <option value="">Wszystkie pojazdy</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make}</option>)}
            </select>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Kierowca</p>
            <select value={selDriver} onChange={e => setSelDriver(e.target.value)}
              className={`border rounded-lg px-3 py-2 text-sm bg-white min-w-48 ${selDriver ? 'border-blue-400' : 'border-slate-200'}`}>
              <option value="">Wszyscy kierowcy</option>
              {drivers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2 flex-wrap min-h-9">
          <span className="text-xs text-slate-400">Aktywne filtry:</span>
          {activeChips.map(chip => (
            <span key={chip.id}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                chip.removable ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-200 text-slate-600'
              }`}>
              {chip.label}
              {chip.removable && (
                <button onClick={chip.clear} className="ml-0.5 text-blue-400 hover:text-blue-800 font-bold text-sm leading-none">×</button>
              )}
            </span>
          ))}
          {(selVid || selDriver) && (
            <button onClick={() => { setSelVid(''); setSelDriver('') }}
              className="text-xs text-slate-400 hover:text-red-500 underline ml-1">
              Wyczyść filtry
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Km łącznie',    value: totalKm.toLocaleString('pl-PL'),  sub: periodLabel(), color: 'text-blue-700' },
          { label: 'Liczba wpisów', value: filtered.length,                   sub: 'w wybranym zakresie' },
          { label: 'Pojazdy',       value: uniqueVids,                        sub: 'z wpisami w zakresie' },
          { label: 'Kierowcy',      value: uniqueDrivers,                     sub: 'aktywnych w zakresie' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className={`kpi-value ${k.color ?? ''}`}>{k.value}</p>
            <p className="kpi-sub">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-vehicle summary */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Zestawienie per pojazd</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rejestracja</th><th>Marka / Model</th>
              <th>Km w zakresie</th><th>Wpisów</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => {
              const vTrips = filtered.filter((t: any) => t.vehicle_id === v.id)
              const km = vTrips.reduce((s: number, t: any) => s + (t.kilometers ?? 0), 0)
              return (
                <tr key={v.id} className={vTrips.length === 0 ? 'opacity-40' : ''}>
                  <td className="font-mono font-bold text-slate-900 text-xs">{v.plate_number}</td>
                  <td className="text-slate-500">{v.make} {v.model}</td>
                  <td className={`font-bold ${km > 0 ? 'text-green-700' : 'text-slate-300'}`}>
                    {km.toLocaleString('pl-PL')} km
                  </td>
                  <td className={vTrips.length === 0 ? 'text-slate-300' : ''}>{vTrips.length}</td>
                </tr>
              )
            })}
            {filtered.length > 0 && (
              <tr className="bg-slate-50 border-t-2 border-slate-300">
                <td colSpan={2} className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Łącznie</td>
                <td className="font-bold text-green-700">{totalKm.toLocaleString('pl-PL')} km</td>
                <td className="font-bold">{filtered.length}</td>
              </tr>
            )}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">
            Brak wpisów dla wybranych filtrów
          </div>
        )}
      </div>

      {/* Detail table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Szczegółowe wpisy <span className="text-slate-400 font-normal">({filtered.length})</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-max">
            <thead>
              <tr>
                <th>Nr</th><th>Data</th><th>Pojazd</th>
                <th>Cel wyjazdu</th><th>Skąd → Dokąd</th>
                <th>Km</th><th>Kierowca</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id} className={!t.confirmed_by_company && t.requires_confirmation ? 'bg-amber-50/40' : ''}>
                  <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>
                  <td className="text-slate-500 whitespace-nowrap tabular-nums">
                    {new Date(t.trip_date).toLocaleDateString('pl-PL')}
                  </td>
                  <td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{t.vehicles?.plate_number}</span></td>
                  <td className="max-w-xs text-xs">{t.purpose.length > 40 ? t.purpose.slice(0, 38) + '…' : t.purpose}</td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{t.route_from.split(',')[0]} → {t.route_to.split(',')[0]}</td>
                  <td className="font-bold whitespace-nowrap tabular-nums">{t.kilometers} km</td>
                  <td className="text-slate-600 whitespace-nowrap text-xs">{t.driver_name_external ?? '—'}</td>
                  <td>
                    {(t.confirmed_by_company || !t.requires_confirmation)
                      ? <span className="badge badge-ok">OK</span>
                      : <span className="badge badge-warn">Do potwierdz.</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-8 text-sm">Brak wpisów w wybranym zakresie</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Wyświetlono <strong className="text-slate-700">{filtered.length}</strong> wpisów</span>
            <span>Suma: <strong className="text-green-700 tabular-nums">{totalKm.toLocaleString('pl-PL')} km</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}
