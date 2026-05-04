'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'

export default function NowyPojazd() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const body = {
      plate_number:             formData.get('plate_number') as string,
      make:                     formData.get('make') as string,
      model:                    formData.get('model') as string,
      vin:                      formData.get('vin') as string || undefined,
      odometer_start:           parseInt(formData.get('odometer_start') as string, 10),
      record_start_date:        formData.get('record_start_date') as string,
      vat26_first_expense_date: formData.get('vat26_first_expense_date') as string || undefined,
    }

    try {
      const res = await fetch('/api/vehicles', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Wystąpił nieoczekiwany błąd')
        return
      }

      router.push('/pojazdy')
      router.refresh()
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nowy pojazd" />

      <div className="main-scroll p-5">
        <div className="card max-w-2xl mx-auto">
          <div className="card-head">
            <span className="card-title">Dane pojazdu</span>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Numer rejestracyjny */}
            <div>
              <label htmlFor="plate_number" className="form-label">
                Numer rejestracyjny <span className="text-red-500">*</span>
              </label>
              <input
                id="plate_number"
                name="plate_number"
                required
                autoFocus
                className="form-input"
                placeholder="np. WZ 12345"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            {/* Marka / Model */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="make" className="form-label">
                  Marka <span className="text-red-500">*</span>
                </label>
                <input
                  id="make"
                  name="make"
                  required
                  className="form-input"
                  placeholder="np. Toyota"
                />
              </div>
              <div>
                <label htmlFor="model" className="form-label">
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  id="model"
                  name="model"
                  required
                  className="form-input"
                  placeholder="np. Corolla"
                />
              </div>
            </div>

            {/* VIN */}
            <div>
              <label htmlFor="vin" className="form-label">
                VIN <span className="text-slate-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                id="vin"
                name="vin"
                className="form-input font-mono"
                placeholder="17 znaków"
                maxLength={17}
              />
            </div>

            {/* Licznik / Data */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="odometer_start" className="form-label">
                  Stan licznika na start <span className="text-red-500">*</span>
                </label>
                <input
                  id="odometer_start"
                  name="odometer_start"
                  type="number"
                  min="0"
                  required
                  className="form-input"
                  placeholder="0"
                />
                <p className="form-hint">km na początku prowadzenia ewidencji</p>
              </div>
              <div>
                <label htmlFor="record_start_date" className="form-label">
                  Początek ewidencji <span className="text-red-500">*</span>
                </label>
                <input
                  id="record_start_date"
                  name="record_start_date"
                  type="date"
                  required
                  className="form-input"
                />
              </div>
            </div>

            {/* VAT-26 */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                VAT-26 — art. 86a ustawy o VAT
              </p>
              <div>
                <label htmlFor="vat26_first_expense_date" className="form-label">
                  Data pierwszego wydatku związanego z pojazdem
                  <span className="text-slate-400 font-normal"> (opcjonalnie)</span>
                </label>
                <input
                  id="vat26_first_expense_date"
                  name="vat26_first_expense_date"
                  type="date"
                  className="form-input"
                />
                <p className="form-hint">
                  Termin złożenia VAT-26 upływa 25. dnia miesiąca następującego po miesiącu
                  pierwszego wydatku. Jeśli zostawisz puste, zostanie użyta data początku ewidencji.
                </p>
              </div>
            </div>

            {/* Błąd */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Przyciski */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-outline"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Zapisywanie…' : 'Zapisz pojazd'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}