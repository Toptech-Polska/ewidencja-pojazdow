'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Vehicle } from '@/types/database'
import type { SimulatedTrip } from '@/lib/simulation/types'
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage'
import type { DbError } from '@/lib/errors/db-errors'

interface Props { vehicles: Vehicle[] }
type TripWithId = SimulatedTrip & { _id: number }
type Step = 'form' | 'preview' | 'success'

function recalculateFrom(trips: TripWithId[], from: number, startOdo: number): TripWithId[] {
  const r = [...trips]; let odo = startOdo
  for (let i = from; i < r.length; i++) {
    const km = r[i].odometer_after - r[i].odometer_before
    r[i] = { ...r[i], odometer_before: odo, odometer_after: odo + km }; odo += km
  }
  return r
}

function deleteTrip(trips: TripWithId[], idx: number): TripWithId[] {
  const next = trips.filter((_, i) => i !== idx)
  if (idx >= next.length) return next
  const odo = idx === 0 ? trips[0].odometer_before : next[idx - 1].odometer_after
  return recalculateFrom(next, idx, odo)
}

function updateKm(trips: TripWithId[], idx: number, km: number): TripWithId[] {
  const r = [...trips]
  r[idx] = { ...r[idx], odometer_after: r[idx].odometer_before + km }
  return idx + 1 < r.length ? recalculateFrom(r, idx + 1, r[idx].odometer_after) : r
}

function EditModal({ trip, index, onSave, onClose }: { trip: TripWithId; index: number; onSave: (i: number, u: any) => void; onClose: () => void }) {
  const [f, setF] = useState({ trip_date: trip.trip_date, purpose: trip.purpose, route_from: trip.route_from, route_to: trip.route_to, km: String(trip.odometer_after - trip.odometer_before) })
  const newOdo = trip.odometer_before + (parseInt(f.km, 10) || 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Edytuj wpis #{index + 1}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="form-label">Data wyjazdu</label><input type="date" className="form-input" value={f.trip_date} onChange={e => setF(p => ({ ...p, trip_date: e.target.value }))} /></div>
          <div><label className="form-label">Cel wyjazdu</label><input type="text" className="form-input" value={f.purpose} onChange={e => setF(p => ({ ...p, purpose: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Skad</label><input type="text" className="form-input" value={f.route_from} onChange={e => setF(p => ({ ...p, route_from: e.target.value }))} /></div>
            <div><label className="form-label">Dokad</label><input type="text" className="form-input" value={f.route_to} onChange={e => setF(p => ({ ...p, route_to: e.target.value }))} /></div>
          </div>
          <div>
            <label className="form-label">Dystans (km)</label>
            <input type="number" min={1} className="form-input" value={f.km} onChange={e => setF(p => ({ ...p, km: e.target.value }))} />
            <p className="form-hint">Zmiana dystansu przeliczy liczniki wszystkich kolejnych wpisow.</p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-50 rounded px-3 py-2">Licznik: {trip.odometer_before.toLocaleString('pl-PL')} &rarr; {newOdo.toLocaleString('pl-PL')} km</div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline">Anuluj</button>
          <button onClick={() => { onSave(index, { ...f, km: parseInt(f.km, 10) || 1 }); onClose() }} className="btn-primary">Zapisz zmiany</button>
        </div>
      </div>
    </div>
  )
}

function PreviewStep({ trips, vehicleLabel, onChange, onSave, onBack, saving, error }: { trips: TripWithId[]; vehicleLabel: string; onChange: (t: TripWithId[]) => void; onSave: () => void; onBack: () => void; saving: boolean; error: DbError | null }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const totalKm = trips.reduce((s, t) => s + t.odometer_after - t.odometer_before, 0)
  function handleEdit(i: number, u: any) {
    let r = [...trips]
    r[i] = { ...r[i], trip_date: u.trip_date, purpose: u.purpose, route_from: u.route_from, route_to: u.route_to }
    onChange(updateKm(r, i, u.km))
  }
  return (
    <div className="p-5 space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
        &#x2139; Ponizsze wpisy trafia do ewidencji. Kazdy wpis bedzie mozna edytowac rowniez po zapisaniu.
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600"><strong>{trips.length}</strong> wpisow dla <strong>{vehicleLabel}</strong> &middot; lacznie <strong>{totalKm.toLocaleString('pl-PL')} km</strong></p>
        {trips.length === 0 && <p className="text-sm text-amber-600 font-medium">&#x26A0; Wszystkie wpisy zostaly usuniete.</p>}
      </div>
      {trips.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-medium text-slate-500">#</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Data</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Cel</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">Trasa</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Km</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">Licznik po</th>
              <th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {trips.map((t, i) => (
                <tr key={t._id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{new Date(t.trip_date).toLocaleDateString('pl-PL')}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={t.purpose}>{t.purpose}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">{t.route_from} &rarr; {t.route_to}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{t.odometer_after - t.odometer_before} km</td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{t.odometer_after.toLocaleString('pl-PL')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditIdx(i)} className="px-2 py-1 text-xs text-blue-700 border border-blue-200 rounded hover:bg-blue-50">Edytuj</button>
                      <button onClick={() => onChange(deleteTrip(trips, i))} className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">Usun</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ApiErrorMessage error={error} />
      <div className="flex justify-between items-center pt-2 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
        <button onClick={onBack} className="btn-outline">&larr; Wróc do formularza</button>
        <button onClick={onSave} disabled={saving || trips.length === 0} className="btn-primary">
          {saving ? 'Zapisywanie...' : `Zapisz ${trips.length} wpisow do ewidencji`}
        </button>
      </div>
      {editIdx !== null && <EditModal trip={trips[editIdx]} index={editIdx} onSave={handleEdit} onClose={() => setEditIdx(null)} />}
    </div>
  )
}

export function SimulacjaForm({ vehicles }: Props) {
  const router = useRouter()
  const today    = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [step,    setStep]    = useState<Step>('form')
  const [trips,   setTrips]   = useState<TripWithId[]>([])
  const [result,  setResult]  = useState<{ count: number; firstEntryNumber: number | null } | null>(null)
  const [error,   setError]   = useState<DbError | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [f, setF] = useState({ vehicle_id: vehicles[0]?.id ?? '', startDate: monthAgo, endDate: today, tripsPerWeek: 5 })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const vLabel = vehicles.find(v => v.id === f.vehicle_id)
  const vehicleLabel = vLabel ? `${vLabel.plate_number} - ${vLabel.make} ${vLabel.model}` : ''

  function validate() {
    const e: Record<string, string> = {}
    if (!f.vehicle_id)                e.vehicle_id  = 'Wybierz pojazd'
    if (!f.startDate)                 e.startDate   = 'Podaj date poczatkowa'
    if (!f.endDate)                   e.endDate     = 'Podaj date koncowa'
    if (f.endDate <= f.startDate)     e.endDate     = 'Data koncowa musi byc pozniejsza'
    if (f.tripsPerWeek < 1 || f.tripsPerWeek > 14) e.tripsPerWeek = 'Zakres 1-14'
    setErrs(e); return Object.keys(e).length === 0
  }

  async function handlePreview() {
    if (!validate()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/simulation/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const data = await res.json()
      if (!res.ok) { setError(data.code ? data : { code: 'db_error', message: data.error ?? 'Blad generowania', hint: '' }); setLoading(false); return }
      setTrips((data.trips as SimulatedTrip[]).map((t, i) => ({ ...t, _id: i })))
      setStep('preview')
    } catch { setError({ code: 'db_error', message: 'Blad polaczenia z serwerem', hint: '' }) }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicle_id: f.vehicle_id, trips: trips.map(({ _id, ...t }) => t) }) })
      const data = await res.json()
      if (!res.ok) { setError(data.code ? data : { code: 'db_error', message: data.error ?? 'Blad zapisu', hint: '' }); setSaving(false); return }
      setResult(data); setStep('success')
    } catch { setError({ code: 'db_error', message: 'Blad polaczenia z serwerem', hint: '' }) }
    setSaving(false)
  }

  if (step === 'success' && result) return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-2xl">&#x2713;</div>
        <p className="text-base font-semibold text-slate-800">Wpisy zapisane w ewidencji</p>
        <p className="text-sm text-slate-500">Dodano <strong>{result.count}</strong> wpisow{result.firstEntryNumber ? ` (numery ${result.firstEntryNumber}-${result.firstEntryNumber + result.count - 1})` : ''}.</p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { setStep('form'); setResult(null) }} className="btn-outline">Nowa symulacja</button>
        <button onClick={() => router.push('/wpisy')} className="btn-primary">Przejdz do ewidencji</button>
      </div>
    </div>
  )

  if (step === 'preview') return (
    <PreviewStep trips={trips} vehicleLabel={vehicleLabel} onChange={setTrips} onSave={handleSave} onBack={() => setStep('form')} saving={saving} error={error} />
  )

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="form-label">Pojazd <span className="text-red-500">*</span></label>
        <select className={`form-input ${errs.vehicle_id ? 'form-input-error' : ''}`} value={f.vehicle_id} onChange={e => setF(p => ({ ...p, vehicle_id: e.target.value }))}>
          <option value="">- wybierz -</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} - {v.make} {v.model}</option>)}
        </select>
        {errs.vehicle_id && <p className="form-error">{errs.vehicle_id}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Data od <span className="text-red-500">*</span></label>
          <input type="date" className={`form-input ${errs.startDate ? 'form-input-error' : ''}`} value={f.startDate} onChange={e => setF(p => ({ ...p, startDate: e.target.value }))} />
          {errs.startDate && <p className="form-error">{errs.startDate}</p>}
        </div>
        <div>
          <label className="form-label">Data do <span className="text-red-500">*</span></label>
          <input type="date" className={`form-input ${errs.endDate ? 'form-input-error' : ''}`} value={f.endDate} onChange={e => setF(p => ({ ...p, endDate: e.target.value }))} />
          {errs.endDate && <p className="form-error">{errs.endDate}</p>}
        </div>
      </div>
      <div>
        <label className="form-label">Wpisow na tydzien <span className="ml-1 font-bold text-blue-700">{f.tripsPerWeek}</span></label>
        <input type="range" min={1} max={14} step={1} className="w-full accent-blue-700" value={f.tripsPerWeek} onChange={e => setF(p => ({ ...p, tripsPerWeek: Number(e.target.value) }))} />
        {errs.tripsPerWeek && <p className="form-error">{errs.tripsPerWeek}</p>}
        <p className="form-hint">1 = rzadkie wyjazdy, 14 = 2x dziennie</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
        &#x2139; Trasy i odleglosci sa obliczane na podstawie lokalizacji z Twojego profilu przez Google Maps.
        Wygenerowane wpisy pojawia sie do podgladu &mdash; mozesz je edytowac lub usunac przed zapisaniem.
      </div>
      <ApiErrorMessage error={error} />
      <div className="flex justify-between items-center pt-2 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
        <button onClick={() => router.back()} className="btn-outline">Anuluj</button>
        <button onClick={handlePreview} disabled={loading || !f.vehicle_id} className="btn-primary">
          {loading ? 'Generowanie...' : 'Generuj podglad'}
        </button>
      </div>
    </div>
  )
}
