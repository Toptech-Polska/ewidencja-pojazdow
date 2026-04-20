'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Vehicle } from '@/types/database'

interface Props {
  vehicles: Vehicle[]
}

interface Result {
  count: number
  firstEntryNumber: number | null
}

export function SimulacjaForm({ vehicles }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [f, setF] = useState({
    vehicle_id:   vehicles[0]?.id ?? '',
    startDate:    monthAgo,
    endDate:      today,
    tripsPerWeek: 5,
    avgKmPerTrip: 80,
  })
  const [errs,    setErrs]    = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState<Result | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!f.vehicle_id)             e.vehicle_id   = 'Wybierz pojazd'
    if (!f.startDate)              e.startDate    = 'Podaj datę początkową'
    if (!f.endDate)                e.endDate      = 'Podaj datę końcową'
    if (f.endDate <= f.startDate)  e.endDate      = 'Data końcowa musi być późniejsza'
    if (f.tripsPerWeek < 1 || f.tripsPerWeek > 14) e.tripsPerWeek = 'Zakres 1–14'
    if (f.avgKmPerTrip < 5 || f.avgKmPerTrip > 500) e.avgKmPerTrip = 'Zakres 5–500 km'
    setErrs(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd generowania'); setSaving(false); return }
      setResult(data)
    } catch {
      setError('Błąd połączenia z serwerem')
    }
    setSaving(false)
  }

  if (result) return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-2xl">✓</div>
        <p className="text-base font-semibold text-slate-800">Symulacja zakończona</p>
        <p className="text-sm text-slate-500">Dodano <strong>{result.count}</strong> wpisów
          {result.firstEntryNumber ? ` (numery ${result.firstEntryNumber}–${result.firstEntryNumber + result.count - 1})` : ''}.
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setResult(null)} className="btn-outline">Nowa symulacja</button>
        <button onClick={() => router.push('/wpisy')} className="btn-primary">Przejdź do ewidencji</button>
      </div>
    </div>
  )

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="form-label">Pojazd <span className="text-red-500">*</span></label>
        <select
          className={`form-input ${errs.vehicle_id ? 'form-input-error' : ''}`}
          value={f.vehicle_id}
          onChange={e => setF(p => ({ ...p, vehicle_id: e.target.value }))}
        >
          <option value="">— wybierz —</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.plate_number} — {v.make} {v.model}</option>
          ))}
        </select>
        {errs.vehicle_id && <p className="form-error">{errs.vehicle_id}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Data od <span className="text-red-500">*</span></label>
          <input type="date" className={`form-input ${errs.startDate ? 'form-input-error' : ''}`}
            value={f.startDate} onChange={e => setF(p => ({ ...p, startDate: e.target.value }))} />
          {errs.startDate && <p className="form-error">{errs.startDate}</p>}
        </div>
        <div>
          <label className="form-label">Data do <span className="text-red-500">*</span></label>
          <input type="date" className={`form-input ${errs.endDate ? 'form-input-error' : ''}`}
            value={f.endDate} onChange={e => setF(p => ({ ...p, endDate: e.target.value }))} />
          {errs.endDate && <p className="form-error">{errs.endDate}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">
            Wpisów na tydzień
            <span className="ml-1 font-bold text-blue-700">{f.tripsPerWeek}</span>
          </label>
          <input type="range" min={1} max={14} step={1}
            className="w-full accent-blue-700"
            value={f.tripsPerWeek}
            onChange={e => setF(p => ({ ...p, tripsPerWeek: Number(e.target.value) }))} />
          {errs.tripsPerWeek && <p className="form-error">{errs.tripsPerWeek}</p>}
          <p className="form-hint">1 = rzadkie wyjazdy, 14 = 2× dziennie</p>
        </div>
        <div>
          <label className="form-label">
            Średni dystans
            <span className="ml-1 font-bold text-blue-700">{f.avgKmPerTrip} km</span>
          </label>
          <input type="range" min={5} max={500} step={5}
            className="w-full accent-blue-700"
            value={f.avgKmPerTrip}
            onChange={e => setF(p => ({ ...p, avgKmPerTrip: Number(e.target.value) }))} />
          {errs.avgKmPerTrip && <p className="form-error">{errs.avgKmPerTrip}</p>}
          <p className="form-hint">±40% wariancja na wpis</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
        ⚠ Symulacja wstawia wpisy do bazy danych. Operacja jest nieodwracalna.
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="flex justify-between items-center pt-2 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
        <button onClick={() => router.back()} className="btn-outline">Anuluj</button>
        <button onClick={handleSubmit} disabled={saving || !f.vehicle_id} className="btn-primary">
          {saving ? 'Generowanie…' : 'Generuj wpisy'}
        </button>
      </div>
    </div>
  )
}
