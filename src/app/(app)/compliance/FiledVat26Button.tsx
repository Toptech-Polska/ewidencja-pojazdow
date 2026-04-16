'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  vehicleId:   string
  plateNumber: string
}

export function FiledVat26Button({ vehicleId, plateNumber }: Props) {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10))
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit() {
    if (!date) { setError('Podaj datę złożenia'); return }
    setSaving(true)
    setError(null)

    const res = await fetch('/api/vat26', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id:       vehicleId,
        vat26_filed_date: date,
        vat26_notes:      notes || undefined,
      }),
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
      {/* Przycisk otwierający modal */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors"
      >
        ✓ Oznacz jako złożony
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Nagłówek */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Złożenie VAT-26</p>
                <p className="text-xs text-slate-400 mt-0.5">{plateNumber}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Treść */}
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">
                  Data złożenia VAT-26 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  autoFocus
                />
                <p className="form-hint">
                  Data faktycznego złożenia informacji VAT-26 do urzędu skarbowego
                </p>
              </div>

              <div>
                <label className="form-label">
                  Notatka <span className="text-slate-400 font-normal">(opcjonalnie)</span>
                </label>
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  placeholder="np. złożono elektronicznie przez ePUAP"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={500}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Stopka */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="btn-outline"
                disabled={saving}
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !date}
                className="btn-primary"
              >
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
