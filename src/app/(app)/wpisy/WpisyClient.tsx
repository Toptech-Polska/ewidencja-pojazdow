'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  vehicles:       any[]
  trips:          any[]
  initialFilter:  'all' | 'pending'
  initialVehicle: string
}

interface EditDraft {
  trip_date:        string
  purpose:          string
  route_from:       string
  route_to:         string
  odometer_before:  string
  odometer_after:   string
}

export function WpisyClient({ vehicles, trips: initialTrips, initialFilter, initialVehicle }: Props) {
  const router = useRouter()
  const [trips, setTrips]       = useState(initialTrips)
  const [filter, setFilter]     = useState<'all' | 'pending'>(initialFilter)
  const [selVid, setSelVid]     = useState(initialVehicle)
  const [confirming, setConfirming] = useState<string | null>(null)

  // Inline edit state
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editDraft, setEditDraft]   = useState<EditDraft>({ trip_date: '', purpose: '', route_from: '', route_to: '', odometer_before: '', odometer_after: '' })
  const [editError, setEditError]   = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const pending = trips.filter(t => t.requires_confirmation && !t.confirmed_by_company)
  const selV = vehicles.find(v => v.id === selVid)

  const filtered = useMemo(() => {
    return trips.filter(t => {
      if (selVid && t.vehicle_id !== selVid) return false
      if (filter === 'pending' && (!t.requires_confirmation || t.confirmed_by_company)) return false
      return true
    })
  }, [trips, filter, selVid])

  // Odometer summary for selected vehicle
  const vTrips = selVid ? trips.filter(t => t.vehicle_id === selVid) : []
  const kmMonth = vTrips
    .filter(t => {
      const d = new Date(t.trip_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, t) => s + (t.kilometers ?? 0), 0)

  const maxOdo = vTrips.length
    ? Math.max(...vTrips.map(t => t.odometer_after))
    : selV?.odometer_start ?? 0

  async function confirmTrip(id: string) {
    setConfirming(id)
    const res = await fetch(`/api/trips/${id}/confirm`, { method: 'PATCH' })
    if (res.ok) {
      setTrips(prev => prev.map(t =>
        t.id === id ? { ...t, confirmed_by_company: true, confirmed_at: new Date().toISOString() } : t
      ))
    }
    setConfirming(null)
    router.refresh()
  }

  function startEdit(trip: any) {
    setEditingId(trip.id)
    setEditDraft({
      trip_date:       trip.trip_date,
      purpose:         trip.purpose,
      route_from:      trip.route_from,
      route_to:        trip.route_to,
      odometer_before: String(trip.odometer_before),
      odometer_after:  String(trip.odometer_after),
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit() {
    const orig = trips.find(t => t.id === editingId)
    if (!orig) return

    const obNum = Number(editDraft.odometer_before)
    const oaNum = Number(editDraft.odometer_after)

    // Frontend basic validation
    if (editDraft.purpose.trim().length < 5) {
      setEditError('Cel wyjazdu musi mieć co najmniej 5 znaków.')
      return
    }
    if (!editDraft.route_from.trim() || !editDraft.route_to.trim()) {
      setEditError('Wypełnij pola trasy (skąd i dokąd).')
      return
    }
    if (isNaN(obNum) || obNum < 0) {
      setEditError('Licznik przed wyjazdem musi być nieujemną liczbą całkowitą.')
      return
    }
    if (isNaN(oaNum) || oaNum <= obNum) {
      setEditError('Licznik po powrocie musi być większy niż przed wyjazdem.')
      return
    }

    const odometerChanged = obNum !== orig.odometer_before || oaNum !== orig.odometer_after

    const payload: Record<string, unknown> = {
      trip_date:  editDraft.trip_date,
      purpose:    editDraft.purpose,
      route_from: editDraft.route_from,
      route_to:   editDraft.route_to,
    }
    // Dodaj odometer TYLKO gdy się zmienił → trigger sprawdza ciągłość tylko wtedy
    if (odometerChanged) {
      payload.odometer_before = obNum
      payload.odometer_after  = oaNum
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/trips/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setEditError(json.message || json.error || 'Błąd zapisu.')
        return
      }
      // Merge updated fields into trips state
      setTrips(prev => prev.map(t =>
        t.id === editingId ? { ...t, ...json } : t
      ))
      setEditingId(null)
      setEditError(null)
    } catch {
      setEditError('Błąd połączenia z serwerem.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="main-scroll p-5">
      <div className="card">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-slate-200 flex-wrap">
          <select
            value={selVid}
            onChange={e => setSelVid(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            style={{ maxWidth: 260 }}
          >
            <option value="">Wszystkie pojazdy</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>
            ))}
          </select>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 font-medium transition-colors ${filter === 'all' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-2 font-medium border-l border-slate-200 transition-colors flex items-center gap-1.5 ${filter === 'pending' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Do potwierdzenia
              {pending.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filter === 'pending' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pending.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1" />
          <Link href="/wpisy/nowy" className="btn-primary text-xs py-1.5 px-3">+ Nowy wpis</Link>
        </div>

        {/* Odometer banner — shown when vehicle selected */}
        {selV && (
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex gap-6 text-xs flex-wrap">
            <span>Licznik startowy: <strong className="text-slate-800">{selV.odometer_start.toLocaleString('pl-PL')} km</strong></span>
            <span>Km w tym miesiącu: <strong className="text-green-700">{kmMonth.toLocaleString('pl-PL')} km</strong></span>
            <span>Licznik bieżący: <strong className="text-blue-700">{maxOdo.toLocaleString('pl-PL')} km</strong></span>
            <span>Wpisów łącznie: <strong>{vTrips.length}</strong></span>
            {pending.filter(t => t.vehicle_id === selVid).length > 0 && (
              <span className="text-amber-700 font-semibold">
                ⚠ {pending.filter(t => t.vehicle_id === selVid).length} wpisów do potwierdzenia
              </span>
            )}
          </div>
        )}

        {/* Art. 86a reminder for pending filter */}
        {filter === 'pending' && pending.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            ⚠ Wpisy kierowców zewnętrznych wymagają potwierdzenia przez spółkę (art. 86a ust. 7 pkt 2 lit. b ustawy o VAT)
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table min-w-max">
            <thead>
              <tr>
                <th>Nr</th><th>Data</th><th>Pojazd</th>
                <th>Cel wyjazdu</th><th>Skąd → Dokąd</th>
                <th>Km</th><th>Licznik</th>
                <th>Kierowca</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-400 py-10 text-sm">
                    {filter === 'pending' ? 'Brak wpisów do potwierdzenia ✓' : 'Brak wpisów'}
                  </td>
                </tr>
              )}
              {filtered.map(t => {
                const veh = t.vehicles as any
                const needsConfirm = t.requires_confirmation && !t.confirmed_by_company

                // ── Inline edit row ──────────────────────────────────────────
                if (t.id === editingId) {
                  return (
                    <tr key={t.id} className="bg-blue-50/30">
                      <td className="font-bold tabular-nums">{t.entry_number}</td>
                      <td>
                        <input
                          type="date"
                          value={editDraft.trip_date}
                          onChange={e => setEditDraft(p => ({ ...p, trip_date: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-32"
                        />
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                          {veh?.plate_number}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editDraft.purpose}
                          onChange={e => setEditDraft(p => ({ ...p, purpose: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-48"
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editDraft.route_from}
                            onChange={e => setEditDraft(p => ({ ...p, route_from: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-28"
                            placeholder="Skąd"
                          />
                          <span className="text-slate-400">→</span>
                          <input
                            type="text"
                            value={editDraft.route_to}
                            onChange={e => setEditDraft(p => ({ ...p, route_to: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-28"
                            placeholder="Dokąd"
                          />
                        </div>
                      </td>
                      <td className="tabular-nums text-xs text-slate-500">
                        {Number(editDraft.odometer_after) - Number(editDraft.odometer_before) || 0} km
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={editDraft.odometer_before}
                            onChange={e => setEditDraft(p => ({ ...p, odometer_before: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-20"
                          />
                          <span className="text-slate-400">→</span>
                          <input
                            type="number"
                            value={editDraft.odometer_after}
                            onChange={e => setEditDraft(p => ({ ...p, odometer_after: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-20"
                          />
                        </div>
                      </td>
                      <td>{/* kierowca - display only */}
                        {t.driver_name_external || (t.profiles as any)?.full_name || '—'}
                      </td>
                      <td>{/* status - display only */}
                        <span className="badge badge-info">Edycja</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {editError && <p className="text-xs text-red-600 max-w-xs">{editError}</p>}
                          <div className="flex gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={editSaving}
                              className="px-2 py-1 bg-blue-700 text-white text-xs rounded font-medium disabled:opacity-50"
                            >
                              {editSaving ? '…' : 'Zapisz'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 bg-white text-slate-600 border border-slate-200 text-xs rounded"
                            >
                              Anuluj
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // ── Normal row ───────────────────────────────────────────────
                const km = t.kilometers ?? (t.odometer_after - t.odometer_before)
                const purpose = t.purpose.length > 40 ? t.purpose.slice(0, 38) + '…' : t.purpose
                return (
                  <tr key={t.id} className={needsConfirm ? 'bg-amber-50/40' : ''}>
                    <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>
                    <td className="text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(t.trip_date).toLocaleDateString('pl-PL')}
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                        {veh?.plate_number}
                      </span>
                    </td>
                    <td className="text-xs max-w-xs">{purpose}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {t.route_from.split(',')[0]} → {t.route_to.split(',')[0]}
                    </td>
                    <td className="font-bold whitespace-nowrap tabular-nums">{km} km</td>
                    <td className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
                      {t.odometer_before.toLocaleString('pl-PL')} → {t.odometer_after.toLocaleString('pl-PL')}
                    </td>
                    <td className="text-slate-600 whitespace-nowrap text-xs">
                      {t.driver_name_external
                        ? <>{t.driver_name_external} <span className="text-amber-600">(zewn.)</span></>
                        : (t.profiles as any)?.full_name ?? '—'
                      }
                    </td>
                    <td>
                      {needsConfirm
                        ? <span className="badge badge-warn">Do potwierdz.</span>
                        : <span className="badge badge-ok">OK</span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {needsConfirm && (
                          <button
                            onClick={() => confirmTrip(t.id)}
                            disabled={confirming === t.id}
                            className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 whitespace-nowrap disabled:opacity-50"
                          >
                            {confirming === t.id ? '…' : '✓ Zatwierdź'}
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(t)}
                          className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded text-xs font-medium hover:bg-slate-100 whitespace-nowrap"
                        >
                          Edytuj
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Wpisów: <strong className="text-slate-700">{filtered.length}</strong></span>
            <span>Km razem: <strong className="text-green-700 tabular-nums">
              {filtered.reduce((s, t) => s + (t.kilometers ?? 0), 0).toLocaleString('pl-PL')} km
            </strong></span>
          </div>
        )}
      </div>
    </div>
  )
}
