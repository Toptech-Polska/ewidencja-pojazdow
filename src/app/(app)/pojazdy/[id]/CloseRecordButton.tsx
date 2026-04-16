'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  vehicleId:     string
  plateNumber:   string
  odometerStart: number
}

export function CloseRecordButton({ vehicleId, plateNumber, odometerStart }: Props) {
  const router = useRouter()
  const [open,   setOpen]   = useState(false)
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [odo,    setOdo]    = useState('')
  const [reason, setReason] = useState<'zakonczony' | 'zmieniony_sposob'>('zakonczony')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit() {
    if (!date || !odo) { setError('Uzupełnij wszystkie pola'); return }
    const odoNum = parseInt(odo, 10)
    if (odoNum < odometerStart) {
      setError('Licznik końcowy nie może być mniejszy niż startowy')
      return
    }
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/vehicles/${vehicleId}/close`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_end_date: date, odometer_end: odoNum, status: reason }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Błąd zapisu')
      setSaving(false)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline text-xs py-1.5 px-3">
        Zamknij ewidencję
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Zamknij ewidencję pojazdu</p>
                <p className="text-xs text-slate-400 mt-0.5">{plateNumber}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Powód zamknięcia <span className="text-red-500">*</span></label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                  {([
                    { v: 'zakonczony'       as const, l: 'Zakończono użytkowanie' },
                    { v: 'zmieniony_sposob' as const, l: 'Zmiana sposobu użytkowania' },
                  ]).map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setReason(v)}
                      className={`flex-1 py-2 px-3 font-medium transition-colors border-r border-slate-200 last:border-r-0 ${
                        reason === v ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >{l}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Data zamknięcia <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Licznik końcowy <span className="text-red-500">*</span></label>
                  <input type="number" className="form-input" min={odometerStart}
                    value={odo} onChange={e => setOdo(e.target.value)} placeholder="km" />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-outline" disabled={saving}>Anuluj</button>
              <button onClick={handleSubmit} disabled={saving || !date || !odo} className="btn-primary">
                {saving ? 'Zapisywanie…' : 'Zamknij ewidencję'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
