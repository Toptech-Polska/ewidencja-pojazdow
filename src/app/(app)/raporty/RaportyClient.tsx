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
  companyName?: string
  companyNip?:  string
}

function driverName(t: any): string {
  return t.driver_name_external ?? t.driver?.full_name ?? t.profiles?.full_name ?? '—'
}

export function RaportyClient({ vehicles, profiles, trips, summaryAll, ymCurrent, ymPrevious, companyName, companyNip }: Props) {
  const [period, setPeriod]       = useState<'current' | 'previous' | 'custom'>('current')
  const [dateFrom, setDateFrom]   = useState(ymCurrent + '-01')
  const [dateTo, setDateTo]       = useState(ymCurrent + '-30')
  const [selVid, setSelVid]       = useState('')
  const [selDriver, setSelDriver] = useState('')

  const drivers = useMemo(() => [...new Set(trips.map((t: any) => driverName(t)).filter(d => d !== '—'))].sort(), [trips])

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
      if (selDriver && driverName(t) !== selDriver) return false
      return true
    })
  }, [trips, period, dateFrom, dateTo, selVid, selDriver, ymCurrent, ymPrevious])

  const totalKm       = filtered.reduce((s: number, t: any) => s + ((t.kilometers ?? 0)), 0)
  const uniqueVids    = [...new Set(filtered.map((t: any) => t.vehicle_id))].length
  const uniqueDrivers = [...new Set(filtered.map((t: any) => driverName(t)).filter(d => d !== '—'))].length

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
        driverName(t),
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

  function exportPdf() {
    const now = new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const period_label = periodLabel()

    const vehicleSummaryRows = vehicles
      .map(v => ({ v, vTrips: filtered.filter((t: any) => t.vehicle_id === v.id) }))
      .filter(({ vTrips }) => vTrips.length > 0)
      .map(({ v, vTrips }) => {
        const km = vTrips.reduce((s: number, t: any) => s + (t.kilometers ?? 0), 0)
        return `
          <tr>
            <td class="mono">${v.plate_number}</td>
            <td>${v.make} ${v.model}</td>
            <td class="num bold">${km.toLocaleString('pl-PL')} km</td>
            <td class="num">${vTrips.length}</td>
          </tr>`
      }).join('')

    const detailRows = filtered.map((t: any, i: number) => {
      const status = (t.confirmed_by_company || !t.requires_confirmation) ? 'OK' : 'Do potwierdz.'
      const statusClass = status === 'OK' ? 'badge-ok' : 'badge-warn'
      const driver = driverName(t)
      return `
        <tr class="${i % 2 === 0 ? '' : 'alt'}">
          <td class="num">${t.entry_number}</td>
          <td class="nowrap">${new Date(t.trip_date).toLocaleDateString('pl-PL')}</td>
          <td class="mono">${t.vehicles?.plate_number ?? ''}</td>
          <td class="purpose">${t.purpose}</td>
          <td class="route">${t.route_from ?? ''} → ${t.route_to ?? ''}</td>
          <td class="num bold">${t.kilometers ?? 0} km</td>
          <td class="driver">${driver}</td>
          <td><span class="badge ${statusClass}">${status}</span></td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Ewidencja przebiegu pojazdu — ${period_label}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 9.5pt; color: #1a1a2e; background: #fff; }
    @page { size: A4 landscape; margin: 12mm 14mm 14mm 14mm; }
    .page { max-width: 100%; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8pt; border-bottom: 2pt solid #1e3a5f; margin-bottom: 10pt; }
    .header-left { display: flex; flex-direction: column; gap: 2pt; }
    .doc-title { font-size: 14pt; font-weight: 700; color: #1e3a5f; letter-spacing: -0.3pt; }
    .doc-subtitle { font-size: 9pt; color: #4b6584; font-weight: 500; }
    .header-right { text-align: right; font-size: 8pt; color: #666; line-height: 1.6; }
    .header-right strong { color: #1a1a2e; font-size: 9pt; }
    .legal-ref { font-size: 7.5pt; color: #888; margin-top: 4pt; font-style: italic; }
    .kpi-bar { display: flex; gap: 0; border: 1pt solid #d0dbe8; border-radius: 4pt; overflow: hidden; margin-bottom: 10pt; }
    .kpi-item { flex: 1; padding: 6pt 10pt; border-right: 1pt solid #d0dbe8; background: #f4f8fc; }
    .kpi-item:last-child { border-right: none; }
    .kpi-label { font-size: 7pt; color: #4b6584; text-transform: uppercase; letter-spacing: 0.4pt; }
    .kpi-value { font-size: 13pt; font-weight: 700; color: #1e3a5f; line-height: 1.2; }
    .kpi-sub   { font-size: 7pt; color: #888; }
    .section-title { font-size: 8.5pt; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5pt; border-left: 3pt solid #1e3a5f; padding-left: 6pt; margin: 10pt 0 5pt; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    thead tr { background: #1e3a5f; color: #fff; }
    thead th { padding: 4.5pt 6pt; text-align: left; font-weight: 600; font-size: 7.5pt; letter-spacing: 0.2pt; white-space: nowrap; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 0.5pt solid #e8eef4; }
    tbody tr.alt { background: #f7fafd; }
    tbody tr:last-child { border-bottom: 1pt solid #1e3a5f; }
    tbody td { padding: 3.5pt 6pt; vertical-align: top; }
    td.num    { text-align: right; white-space: nowrap; }
    td.nowrap { white-space: nowrap; }
    td.mono   { font-family: monospace; font-weight: 700; font-size: 8pt; }
    td.bold   { font-weight: 700; }
    td.purpose { max-width: 120pt; }
    td.route  { font-size: 7.5pt; color: #333; }
    td.driver { font-size: 8pt; color: #222; font-weight: 500; }
    .summary-row td { background: #eaf1f8; font-weight: 700; border-top: 1.5pt solid #1e3a5f; color: #1e3a5f; font-size: 8.5pt; }
    .badge { display: inline-block; font-size: 6.5pt; font-weight: 700; padding: 1.5pt 4pt; border-radius: 3pt; text-transform: uppercase; letter-spacing: 0.3pt; }
    .badge-ok   { background: #e6f9ee; color: #166534; border: 0.5pt solid #bbf7d0; }
    .badge-warn { background: #fef9c3; color: #854d0e; border: 0.5pt solid #fde68a; }
    .footer { margin-top: 12pt; padding-top: 6pt; border-top: 0.5pt solid #ccc; display: flex; justify-content: space-between; font-size: 7pt; color: #888; }
    .signature-block { margin-top: 18pt; display: flex; justify-content: flex-end; gap: 40pt; }
    .signature-line { text-align: center; font-size: 7.5pt; color: #555; }
    .signature-line::before { content: ''; display: block; width: 120pt; border-top: 0.75pt solid #333; margin: 0 auto 3pt; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="doc-title">Ewidencja przebiegu pojazdu</div>
      <div class="doc-subtitle">Okres: ${period_label}</div>
      <div class="legal-ref">Dokument sporządzony na potrzeby art. 86a ust. 4 pkt 1 ustawy z dnia 11 marca 2004 r. o podatku od towarów i usług</div>
    </div>
    <div class="header-right">
      ${companyName ? `<strong>${companyName}</strong><br>` : ''}
      ${companyNip  ? `NIP: ${companyNip}<br>` : ''}
      Data wydruku: ${now}<br>
      Liczba wpisów: <strong>${filtered.length}</strong>
    </div>
  </div>
  <div class="kpi-bar">
    <div class="kpi-item"><div class="kpi-label">Km łącznie</div><div class="kpi-value">${totalKm.toLocaleString('pl-PL')} km</div><div class="kpi-sub">${period_label}</div></div>
    <div class="kpi-item"><div class="kpi-label">Liczba wpisów</div><div class="kpi-value">${filtered.length}</div><div class="kpi-sub">w wybranym zakresie</div></div>
    <div class="kpi-item"><div class="kpi-label">Pojazdy</div><div class="kpi-value">${uniqueVids}</div><div class="kpi-sub">z wpisami w zakresie</div></div>
    <div class="kpi-item"><div class="kpi-label">Kierowcy</div><div class="kpi-value">${uniqueDrivers}</div><div class="kpi-sub">aktywnych w zakresie</div></div>
  </div>
  <div class="section-title">Zestawienie per pojazd</div>
  <table>
    <thead><tr><th>Rejestracja</th><th>Marka / Model</th><th class="num">Km w zakresie</th><th class="num">Liczba wpisów</th></tr></thead>
    <tbody>
      ${vehicleSummaryRows}
      <tr class="summary-row"><td colspan="2">ŁĄCZNIE</td><td class="num">${totalKm.toLocaleString('pl-PL')} km</td><td class="num">${filtered.length}</td></tr>
    </tbody>
  </table>
  <div class="section-title" style="margin-top:14pt">Szczegółowe wpisy ewidencji</div>
  <table>
    <thead>
      <tr>
        <th class="num">Nr</th><th>Data</th><th>Pojazd</th><th>Cel wyjazdu</th>
        <th>Trasa (skąd → dokąd)</th><th class="num">Km</th><th>Kierowca</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
      <tr class="summary-row">
        <td colspan="5" style="text-align:right">SUMA:</td>
        <td class="num">${totalKm.toLocaleString('pl-PL')} km</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
  <div class="signature-block">
    <div class="signature-line">Sporządził / Sporządziła</div>
    <div class="signature-line">Zatwierdził / Zatwierdziła</div>
  </div>
  <div class="footer">
    <span>Ewidencja przebiegu pojazdu — wygenerowano automatycznie ${now}</span>
    <span>Art. 86a ust. 4 pkt 1 ustawy o VAT — pojazd wykorzystywany wyłącznie do działalności gospodarczej</span>
  </div>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script>
</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank', 'width=1100,height=800')
    if (!win) {
      const a = document.createElement('a')
      a.href = url
      a.download = `ewidencja-km_${period_label.replace(/ /g, '_')}.html`
      a.click()
    }
  }

  return (
    <div className="main-scroll p-5 space-y-4">
      <div className="card">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtry zestawienia</span>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-100 text-slate-600 font-medium">↓ CSV</button>
            <button onClick={exportPdf} className="text-xs px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-medium">↓ PDF (VAT-26)</button>
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
                  }`}>{label}</button>
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
            <span key={chip.id} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
              className="text-xs text-slate-400 hover:text-red-500 underline ml-1">Wyczyść filtry</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Km łącznie',    value: totalKm.toLocaleString('pl-PL'), sub: periodLabel(), color: 'text-blue-700' },
          { label: 'Liczba wpisów', value: filtered.length,                  sub: 'w wybranym zakresie' },
          { label: 'Pojazdy',       value: uniqueVids,                       sub: 'z wpisami w zakresie' },
          { label: 'Kierowcy',      value: uniqueDrivers,                    sub: 'aktywnych w zakresie' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className={`kpi-value ${k.color ?? ''}`}>{k.value}</p>
            <p className="kpi-sub">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Zestawienie per pojazd</span></div>
        <table className="data-table">
          <thead><tr><th>Rejestracja</th><th>Marka / Model</th><th>Km w zakresie</th><th>Wpisów</th></tr></thead>
          <tbody>
            {vehicles.map(v => {
              const vTrips = filtered.filter((t: any) => t.vehicle_id === v.id)
              const km = vTrips.reduce((s: number, t: any) => s + (t.kilometers ?? 0), 0)
              return (
                <tr key={v.id} className={vTrips.length === 0 ? 'opacity-40' : ''}>
                  <td className="font-mono font-bold text-slate-900 text-xs">{v.plate_number}</td>
                  <td className="text-slate-500">{v.make} {v.model}</td>
                  <td className={`font-bold ${km > 0 ? 'text-green-700' : 'text-slate-300'}`}>{km.toLocaleString('pl-PL')} km</td>
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
        {filtered.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Brak wpisów dla wybranych filtrów</div>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Szczegółowe wpisy <span className="text-slate-400 font-normal">({filtered.length})</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-max">
            <thead>
              <tr><th>Nr</th><th>Data</th><th>Pojazd</th><th>Cel wyjazdu</th><th>Skąd → Dokąd</th><th>Km</th><th>Kierowca</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((t: any) => (
                <tr key={t.id} className={!t.confirmed_by_company && t.requires_confirmation ? 'bg-amber-50/40' : ''}>
                  <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>
                  <td className="text-slate-500 whitespace-nowrap tabular-nums">{new Date(t.trip_date).toLocaleDateString('pl-PL')}</td>
                  <td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{t.vehicles?.plate_number}</span></td>
                  <td className="max-w-xs text-xs">{t.purpose.length > 40 ? t.purpose.slice(0, 38) + '…' : t.purpose}</td>
                  <td className="text-xs text-slate-500">{t.route_from} → {t.route_to}</td>
                  <td className="font-bold whitespace-nowrap tabular-nums">{t.kilometers} km</td>
                  <td className="text-slate-600 whitespace-nowrap text-xs">{driverName(t)}</td>
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
