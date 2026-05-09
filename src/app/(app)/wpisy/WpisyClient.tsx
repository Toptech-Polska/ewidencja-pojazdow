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

interface EditState {
  id:         string
  trip_date:  string
  purpose:    string
  route_from: string
  route_to:   string
}

export function WpisyClient({ vehicles, trips: initialTrips, initialFilter, initialVehicle }: Props) {
  const router = useRouter()
  const [trips, setTrips]           = useState(initialTrips)
  const [filter, setFilter]         = useState<'all' | 'pending'>(initialFilter)
  const [selVid, setSelVid]         = useState(initialVehicle)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [editing, setEditing]       = useState<EditState | null>(null)
  const [saving, setSaving]         = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)

  const pending = trips.filter(t => t.requires_confirmation && !t.confirmed_by_company)
  const selV    = vehicles.find(v => v.id === selVid)

  const filtered = useMemo(() => trips.filter(t => {
    if (selVid && t.vehicle_id !== selVid) return false
    if (filter === 'pending' && (!t.requires_confirmation || t.confirmed_by_company)) return false
    return true
  }), [trips, filter, selVid])

  const vTrips  = selVid ? trips.filter(t => t.vehicle_id === selVid) : []
  const kmMonth = vTrips
    .filter(t => { const d = new Date(t.trip_date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() })
    .reduce((s, t) => s + (t.kilometers ?? 0), 0)
  const maxOdo  = vTrips.length ? Math.max(...vTrips.map(t => t.odometer_after)) : selV?.odometer_start ?? 0

  function startEdit(t: any) {
    setEditing({ id: t.id, trip_date: t.trip_date, purpose: t.purpose, route_from: t.route_from, route_to: t.route_to })
    setEditError(null)
  }

  function cancelEdit() { setEditing(null); setEditError(null) }

  async function saveEdit() {
    if (!editing) return
    setSaving(true); setEditError(null)
    try {
      const res = await fetch(`/api/trips/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_date:  editing.trip_date,
          purpose:    editing.purpose,
          route_from: editing.route_from,
          route_to:   editing.route_to,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Błąd zapisu'); setSaving(false); return }
      setTrips(prev => prev.map(t => t.id === editing.id
        ? { ...t, trip_date: data.trip_date, purpose: data.purpose, route_from: data.route_from, route_to: data.route_to, updated_at: data.updated_at }
        : t
      ))
      setEditing(null)
      router.refresh()
    } catch { setEditError('Błąd połączenia z serwerem') }
    setSaving(false)
  }

  async function confirmTrip(id: string) {
    setConfirming(id)
    const res = await fetch(`/api/trips/${id}/confirm`, { method: 'PATCH' })
    if (res.ok) setTrips(prev => prev.map(t => t.id === id ? { ...t, confirmed_by_company: true, confirmed_at: new Date().toISOString() } : t))
    setConfirming(null)
    router.refresh()
  }

  return (
    <div className="main-scroll p-5">
      <div className="card">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-3 border-b border-slate-200 flex-wrap">
          <select value={selVid} onChange={e => setSelVid(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" style={{ maxWidth: 260 }}>
            <option value="">Wszystkie pojazdy</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>)}
          </select>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-2 font-medium transition-colors ${filter === 'all' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Wszystkie
            </button>
            <button onClick={() => setFilter('pending')}
              className={`px-3 py-2 font-medium border-l border-slate-200 transition-colors flex items-center gap-1.5 ${filter === 'pending' ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Do potwierdzenia
              {pending.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filter === 'pending' ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{pending.length}</span>
              )}
            </button>
          </div>
          <div className="flex-1" />
          <Link href="/wpisy/nowy" className="btn-primary text-xs py-1.5 px-3">+ Nowy wpis</Link>
        </div>

        {/* Odometer banner */}
        {selV && (
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex gap-6 text-xs flex-wrap">
            <span>Licznik startowy: <strong className="text-slate-800">{selV.odometer_start.toLocaleString('pl-PL')} km</strong></span>
            <span>Km w tym miesiącu: <strong className="text-green-700">{kmMonth.toLocaleString('pl-PL')} km</strong></span>
            <span>Licznik bieżący: <strong className="text-blue-700">{maxOdo.toLocaleString('pl-PL')} km</strong></span>
            <span>Wpisów: <strong>{vTrips.length}</strong></span>
          </div>
        )}

        {filter === 'pending' && pending.length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
            ⚠ Wpisy kierowców zewnętrznych wymagają potwierdzenia przez spółkę (art. 86a ust. 7 pkt 2 lit. b)
          </div>
        )}

        {/* Inline edit error */}
        {editError && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{editError}</div>
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
                <tr><td colSpan={10} className="text-center text-slate-400 py-10 text-sm">
                  {filter === 'pending' ? 'Brak wpisów do potwierdzenia ✓' : 'Brak wpisów'}
                </td></tr>
              )}
              {filtered.map(t => {
                const veh          = t.vehicles as any
                const isEditing    = editing?.id === t.id
                const needsConfirm = t.requires_confirmation && !t.confirmed_by_company
                const isConfirmed  = t.confirmed_by_company
                const km           = t.kilometers ?? (t.odometer_after - t.odometer_before)
                return (
                  <tr key={t.id} className={isEditing ? 'bg-blue-50/60' : needsConfirm ? 'bg-amber-50/40' : ''}>
                    <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>

                    {/* Data */}
                    <td className="whitespace-nowrap">
                      {isEditing
                        ? <input type="date" className="form-input py-0.5 text-xs w-32 tabular-nums"
                            value={editing.trip_date}
                            onChange={e => setEditing(p => p ? { ...p, trip_date: e.target.value } : p)} />
                        : <span className="text-slate-500 tabular-nums text-xs">{new Date(t.trip_date).toLocaleDateString('pl-PL')}</span>
                      }
                    </td>

                    <td>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{veh?.plate_number}</span>
                    </td>

                    {/* Cel wyjazdu */}
                    <td className="max-w-xs">
                      {isEditing
                        ? <input type="text" className="form-input py-0.5 text-xs w-full min-w-[200px]"
                            value={editing.purpose}
                            onChange={e => setEditing(p => p ? { ...p, purpose: e.target.value } : p)}
                            placeholder="Cel wyjazdu" />
                        : <span className="text-xs">{t.purpose.length > 42 ? t.purpose.slice(0, 40) + '…' : t.purpose}</span>
                      }
                    </td>

                    {/* Trasa */}
                    <td className="whitespace-nowrap">
                      {isEditing
                        ? <div className="flex items-center gap-1">
                            <input type="text" className="form-input py-0.5 text-xs w-28"
                              value={editing.route_from}
                              onChange={e => setEditing(p => p ? { ...p, route_from: e.target.value } : p)}
                              placeholder="Skąd" />
                            <span className="text-slate-400 text-xs">→</span>
                            <input type="text" className="form-input py-0.5 text-xs w-28"
                              value={editing.route_to}
                              onChange={e => setEditing(p => p ? { ...p, route_to: e.target.value } : p)}
                              placeholder="Dokąd" />
                          </div>
                        : <span className="text-xs text-slate-500">{t.route_from.split(',')[0]} → {t.route_to.split(',')[0]}</span>
                      }
                    </td>

                    <td className="font-bold whitespace-nowrap tabular-nums text-xs">{km} km</td>
                    <td className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
                      {t.odometer_before.toLocaleString('pl-PL')} → {t.odometer_after.toLocaleString('pl-PL')}
                    </td>
                    <td className="text-slate-600 whitespace-nowrap text-xs">
                      {t.driver_name_external
                        ? <>{t.driver_name_external} <span className="text-amber-600">(zewn.)</span></>
                        : (t.driver as any)?.full_name ?? '—'}
                    </td>
                    <td>
                      {needsConfirm
                        ? <span className="badge badge-warn">Do potwierdz.</span>
                        : <span className="badge badge-ok">OK</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} disabled={saving}
                              className="text-xs text-white bg-blue-700 hover:bg-blue-800 font-medium px-2 py-1 rounded disabled:opacity-50">
                              {saving ? '…' : 'Zapisz'}
                            </button>
                            <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                              Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            {!isConfirmed && (
                              <button onClick={() => startEdit(t)} title="Edytuj wpis"
                                className="text-slate-400 hover:text-blue-600 transition-colors p-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                            )}
                            {needsConfirm && (
                              <button onClick={() => confirmTrip(t.id)} disabled={confirming === t.id}
                                className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 disabled:opacity-50">
                                {confirming === t.id ? '…' : '✓ Zatwierdź'}
                              </button>
                            )}
                          </>
                        )}
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
