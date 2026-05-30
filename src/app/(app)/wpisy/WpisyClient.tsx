'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TODAY = new Date().toISOString().slice(0, 10)

interface Props {
  vehicles:       any[]
  trips:          any[]
  initialFilter:  'all' | 'pending'
  initialVehicle: string
}

interface EditDraft {
  trip_date:  string
  purpose:    string
  route_from: string
  route_to:   string
  kilometers: string
}

export function WpisyClient({ vehicles, trips: initialTrips, initialFilter, initialVehicle }: Props) {
  const router = useRouter()
  const [trips, setTrips]           = useState(initialTrips)
  const [filter, setFilter]         = useState<'all' | 'pending'>(initialFilter)
  const [selVid, setSelVid]         = useState(initialVehicle)
  const [confirming, setConfirming] = useState<string | null>(null)

  // Sync trips state when Server Component re-renders after router.refresh()
  useEffect(() => { setTrips(initialTrips) }, [initialTrips])

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editDraft,  setEditDraft]  = useState<EditDraft>({ trip_date: '', purpose: '', route_from: '', route_to: '', kilometers: '' })
  const [editError,  setEditError]  = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // ── Delete state ──────────────────────────────────────────────
  const [deleteTrip,     setDeleteTrip]     = useState<any | null>(null)
  const [deleteDeleting, setDeleteDeleting] = useState(false)

  const pending = trips.filter(t => t.requires_confirmation && !t.confirmed_by_company)
  const selV    = vehicles.find(v => v.id === selVid)

  // When vehicle selected: sort by entry_number ASC; otherwise keep server order
  const filtered = useMemo(() => {
    const result = trips.filter(t => {
      if (selVid && t.vehicle_id !== selVid) return false
      if (filter === 'pending' && (!t.requires_confirmation || t.confirmed_by_company)) return false
      return true
    })
    return selVid ? [...result].sort((a, b) => a.entry_number - b.entry_number) : result
  }, [trips, filter, selVid])

  const vTrips  = selVid ? trips.filter(t => t.vehicle_id === selVid) : []
  const kmMonth = vTrips
    .filter(t => { const d = new Date(t.trip_date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() })
    .reduce((s, t) => s + (t.kilometers ?? 0), 0)
  const maxOdo  = vTrips.length ? Math.max(...vTrips.map(t => t.odometer_after)) : selV?.odometer_start ?? 0

  function formatDate(iso: string) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pl-PL')
  }

  function getNeighbors(vehicleId: string, entryNumber: number) {
    const vt = trips.filter(t => t.vehicle_id === vehicleId)
    return {
      prev: vt.find(t => t.entry_number === entryNumber - 1) ?? null,
      next: vt.find(t => t.entry_number === entryNumber + 1) ?? null,
    }
  }

  // ── Confirm ───────────────────────────────────────────────────
  async function confirmTrip(id: string) {
    setConfirming(id)
    const res = await fetch(`/api/trips/${id}/confirm`, { method: 'PATCH' })
    if (res.ok) setTrips(prev => prev.map(t => t.id === id ? { ...t, confirmed_by_company: true, confirmed_at: new Date().toISOString() } : t))
    setConfirming(null)
    router.refresh()
  }

  // ── Edit ──────────────────────────────────────────────────────
  function startEdit(trip: any) {
    setEditingId(trip.id)
    setEditDraft({
      trip_date:  trip.trip_date,
      purpose:    trip.purpose,
      route_from: trip.route_from,
      route_to:   trip.route_to,
      kilometers: String(trip.kilometers ?? trip.odometer_after - trip.odometer_before),
    })
    setEditError(null)
  }

  function cancelEdit() { setEditingId(null); setEditError(null) }

  async function saveEdit() {
    const orig = trips.find(t => t.id === editingId)
    if (!orig) return

    const km = Number(editDraft.kilometers)
    if (editDraft.purpose.trim().length < 5) { setEditError('Cel wyjazdu musi mieć co najmniej 5 znaków.'); return }
    if (!editDraft.route_from.trim() || !editDraft.route_to.trim()) { setEditError('Wypełnij pola trasy.'); return }
    if (!Number.isInteger(km) || km < 1) { setEditError('Dystans musi być co najmniej 1 km.'); return }

    // Z4: client-side date validation — reset to valid bound so calendar stays usable
    const { prev, next } = getNeighbors(orig.vehicle_id, orig.entry_number)
    if (prev && editDraft.trip_date < prev.trip_date) {
      setEditDraft(p => ({ ...p, trip_date: prev.trip_date }))
      setEditError(`Data nie może być wcześniejsza niż ${formatDate(prev.trip_date)}.`); return
    }
    if (next && editDraft.trip_date > next.trip_date) {
      setEditDraft(p => ({ ...p, trip_date: next.trip_date }))
      setEditError(`Data nie może być późniejsza niż ${formatDate(next.trip_date)}.`); return
    }

    const newOdometerAfter = orig.odometer_before + km
    const payload: Record<string, unknown> = {
      trip_date:  editDraft.trip_date,
      purpose:    editDraft.purpose,
      route_from: editDraft.route_from,
      route_to:   editDraft.route_to,
    }
    // Z1: include odometer_after only when km changed — triggers propagation on server
    if (newOdometerAfter !== orig.odometer_after) {
      payload.odometer_after = newOdometerAfter
    }

    setEditSaving(true); setEditError(null)
    try {
      const res = await fetch(`/api/trips/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.message || json.error || 'Błąd zapisu.'); return }
      setEditingId(null)
      router.refresh()
    } catch {
      setEditError('Błąd połączenia z serwerem.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function deleteEntry() {
    if (!deleteTrip) return
    setDeleteDeleting(true)
    try {
      const res = await fetch(`/api/trips/${deleteTrip.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { alert(json.message || json.error || 'Błąd usuwania.'); return }
      setDeleteTrip(null)
      router.refresh()
    } catch {
      alert('Błąd połączenia z serwerem.')
    } finally {
      setDeleteDeleting(false)
    }
  }

  return (
    <div className="main-scroll p-5">

      {/* ── Delete confirm modal ─────────────────────────────── */}
      {deleteTrip && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-semibold text-slate-800 text-lg">Usuń wpis</h3>
            <p className="text-sm text-slate-600">
              Czy na pewno chcesz usunąć wpis nr <strong>{deleteTrip.entry_number}</strong>{' '}
              z dnia <strong>{formatDate(deleteTrip.trip_date)}</strong>?
            </p>
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Licznik zostanie skorygowany o{' '}
              <strong>−{deleteTrip.kilometers ?? deleteTrip.odometer_after - deleteTrip.odometer_before} km</strong>{' '}
              na wszystkich kolejnych wpisach tego pojazdu.
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setDeleteTrip(null)} className="btn-outline" disabled={deleteDeleting}>Anuluj</button>
              <button onClick={deleteEntry} disabled={deleteDeleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteDeleting ? 'Usuwanie…' : 'Usuń wpis'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
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

        {editError && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{editError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-[82px]" />
              <col className="w-[74px]" />
              <col className="w-36" />
              <col />
              <col className="w-14" />
              <col className="w-36" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-40" />
            </colgroup>
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
                const needsConfirm = t.requires_confirmation && !t.confirmed_by_company
                const driverName   = t.driver_name_external || (t.driver as any)?.full_name || '—'

                // ── Inline edit row ──────────────────────────────
                if (t.id === editingId) {
                  const orig = trips.find(x => x.id === editingId)
                  const computedOa = orig ? orig.odometer_before + (Number(editDraft.kilometers) || 0) : 0
                  const { prev, next } = getNeighbors(t.vehicle_id, t.entry_number)
                  const dateErr = editError?.startsWith('Data')
                  return (
                    <tr key={t.id} className="bg-blue-50/30">
                      <td className="font-bold tabular-nums">{t.entry_number}</td>
                      <td>
                        <input type="date"
                          value={editDraft.trip_date}
                          min={prev?.trip_date}
                          max={next?.trip_date ?? TODAY}
                          onChange={e => setEditDraft(p => ({ ...p, trip_date: e.target.value }))}
                          className={`border rounded px-2 py-1 text-xs w-full ${dateErr ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                        />
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{veh?.plate_number}</span>
                      </td>
                      <td className="overflow-hidden">
                        <input type="text" value={editDraft.purpose}
                          onChange={e => setEditDraft(p => ({ ...p, purpose: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full" />
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <input type="text" value={editDraft.route_from} placeholder="Skąd"
                            onChange={e => setEditDraft(p => ({ ...p, route_from: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-full" />
                          <input type="text" value={editDraft.route_to} placeholder="Dokąd"
                            onChange={e => setEditDraft(p => ({ ...p, route_to: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-full" />
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <input type="number" min={1} value={editDraft.kilometers}
                            onChange={e => setEditDraft(p => ({ ...p, kilometers: e.target.value }))}
                            className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                          />
                        </div>
                      </td>
                      <td className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {(orig?.odometer_before ?? 0).toLocaleString('pl-PL')} → {computedOa.toLocaleString('pl-PL')}
                      </td>
                      <td>{driverName}</td>
                      <td><span className="badge badge-info">Edycja</span></td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {editError && <p className="text-xs text-red-600 max-w-[200px]">{editError}</p>}
                          <div className="flex gap-1">
                            <button onClick={saveEdit} disabled={editSaving}
                              className="px-2 py-1 bg-blue-700 text-white text-xs rounded font-medium disabled:opacity-50">
                              {editSaving ? '…' : 'Zapisz'}
                            </button>
                            <button onClick={cancelEdit}
                              className="px-2 py-1 bg-white text-slate-600 border border-slate-200 text-xs rounded">
                              Anuluj
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // ── Normal row ───────────────────────────────────
                const km      = t.kilometers ?? (t.odometer_after - t.odometer_before)
                const purpose = t.purpose.length > 40 ? t.purpose.slice(0, 38) + '…' : t.purpose
                return (
                  <tr key={t.id} className={needsConfirm ? 'bg-amber-50/40' : ''}>
                    <td className="font-bold text-slate-900 tabular-nums">{t.entry_number}</td>
                    <td className="whitespace-nowrap">
                      <span className="text-slate-500 tabular-nums text-xs">{new Date(t.trip_date).toLocaleDateString('pl-PL')}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{veh?.plate_number}</span>
                    </td>
                    <td className="overflow-hidden">
                      <span className="text-xs truncate block">{purpose}</span>
                    </td>
                    <td className="text-xs text-slate-500 break-words min-w-0">
                      {t.route_from} → {t.route_to}
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
                      <div className="flex gap-1 flex-wrap items-center">
                        {needsConfirm && (
                          <button onClick={() => confirmTrip(t.id)} disabled={confirming === t.id}
                            className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 whitespace-nowrap disabled:opacity-50">
                            {confirming === t.id ? '…' : '✓ Zatwierdź'}
                          </button>
                        )}
                        {selVid && (
                          <Link href={`/wpisy/nowy?insertAfter=${t.id}`}
                            title={`Dodaj wpis po nr ${t.entry_number}`}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-medium hover:bg-emerald-100 whitespace-nowrap">
                            + Wstaw
                          </Link>
                        )}
                        <button onClick={() => startEdit(t)}
                          className="px-2 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded text-xs font-medium hover:bg-slate-100 whitespace-nowrap">
                          Edytuj
                        </button>
                        <button onClick={() => setDeleteTrip(t)}
                          className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100 whitespace-nowrap">
                          Usuń
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
