'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Topbar } from '@/components/layout/Topbar'
import { getLastOdometer } from '@/lib/trips/odometer'
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage'
import type { DbError } from '@/lib/errors/db-errors'
import type { Vehicle, Profile } from '@/types/database'
import { buildReturnEntry } from '@/lib/wpisy/buildReturnEntry'

async function loadVehiclesAndProfiles() {
  const supabase = createClient()
  const [{ data: veh }, { data: prof }] = await Promise.all([
    supabase.schema('vat_km').from('vehicles').select('id, plate_number, make, model, odometer_start, status').eq('status', 'aktywny').order('plate_number'),
    supabase.schema('vat_km').from('profiles').select('id, full_name, role').eq('is_active', true)
      .in('role', ['administrator', 'ksiegowosc', 'kierowca']).order('full_name'),
  ])
  return { vehicles: veh ?? [], profiles: prof ?? [] }
}


function TripForm({ vehicles, profiles }: { vehicles: Vehicle[]; profiles: Profile[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<0 | 1 | 2>(0)
  const [createReturn, setCreateReturn] = useState(false)
  const [error,  setError]  = useState<DbError | null>(null)
  const [errs,   setErrs]   = useState<Record<string, string>>({})
  const [f, setF] = useState({
    vehicle_id: vehicles[0]?.id ?? '', trip_date: new Date().toISOString().slice(0, 10),
    purpose: '', route_from: '', route_to: '', odometer_before: '', odometer_after: '',
    driver_type: 'internal' as 'internal' | 'external',
    driver_id: profiles[0]?.id ?? '', driver_name_external: '',
  })

  useEffect(() => {
    if (!f.vehicle_id) return
    const veh = vehicles.find(v => v.id === f.vehicle_id)
    if (!veh) return
    getLastOdometer(f.vehicle_id, veh.odometer_start).then(({ odometer }) =>
      setF(p => ({ ...p, odometer_before: String(odometer) }))
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.vehicle_id])

  const obNum = f.odometer_before ? Number(f.odometer_before) : 0
  const oaNum = f.odometer_after  ? Number(f.odometer_after)  : 0
  const km    = f.odometer_after  ? oaNum - obNum             : null

  function validate() {
    const e: Record<string, string> = {}
    if (!f.vehicle_id)        e.vehicle_id = 'Wybierz pojazd'
    if (f.purpose.length < 5) e.purpose    = 'Podaj cel wyjazdu (min. 5 znakow)'
    if (!f.route_from)        e.route_from = 'Pole wymagane'
    if (!f.route_to)          e.route_to   = 'Pole wymagane'
    if (!f.odometer_before)   e.odometer_before = 'Podaj stan licznika'
    if (!f.odometer_after)    e.odometer_after  = 'Podaj stan licznika'
    if (oaNum <= obNum)       e.odometer_after  = `Musi byc > ${obNum.toLocaleString('pl-PL')} km`
    if (f.driver_type === 'external' && !f.driver_name_external)
      e.driver_name_external = 'Podaj imie i nazwisko'
    if (f.driver_type === 'internal' && !f.driver_id)
      e.driver_id = 'Wybierz kierowce'
    setErrs(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/trips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: f.vehicle_id, trip_date: f.trip_date, purpose: f.purpose,
          route_from: f.route_from, route_to: f.route_to,
          odometer_before: obNum, odometer_after: oaNum,
          driver_id: f.driver_type === 'internal' ? f.driver_id : undefined,
          driver_name_external: f.driver_type === 'external' ? f.driver_name_external : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.code ? d : { code: 'db_error', message: d.error ?? 'Blad zapisu', hint: '' })
        setSaving(false); return
      }
      if (createReturn) {
        const returnEntry = buildReturnEntry({
          vehicle_id: f.vehicle_id,
          trip_date: f.trip_date,
          purpose: f.purpose,
          route_from: f.route_from,
          route_to: f.route_to,
          odometer_before: obNum,
          odometer_after: oaNum,
          driver_id: f.driver_type === 'internal' ? f.driver_id : undefined,
          driver_name_external: f.driver_type === 'external' ? f.driver_name_external : undefined,
        })
        const returnRes = await fetch('/api/trips', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnEntry),
        })
        if (!returnRes.ok) {
          const rd = await returnRes.json()
          // Oryginal zapisany, powrot nie — pokaz ostrzezenie
          const returnErrMsg = rd.hint || rd.message || rd.error || 'Blad zapisu'
          setError({ code: 'db_error', message: `Zapisano wyjazd, ale nie udalo sie utworzyc powrotu: ${returnErrMsg}. Dodaj powrot recznie.`, hint: '' })
          setSavedCount(1)
          setSaving(false)
          setTimeout(() => router.push('/wpisy'), 3000)
          return
        }
        setSavedCount(2)
      } else {
        setSavedCount(1)
      }
      setTimeout(() => router.push('/wpisy'), 1500)
    } catch {
      setError({ code: 'db_error', message: 'Blad polaczenia z serwerem', hint: '' })
      setSaving(false)
    }
  }

  if (savedCount > 0) return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-3xl">&#x2713;</div>
      <h2 className="text-lg font-semibold text-slate-800">
        {savedCount === 2 ? 'Zapisano 2 wpisy (wyjazd i powrót)' : 'Wpis zapisany pomyslnie'}
      </h2>
      <p className="text-sm text-slate-400">Przekierowuje&hellip;</p>
    </div>
  )

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Pojazd <span className="text-red-500">*</span></label>
          <select className={`form-input ${errs.vehicle_id ? 'form-input-error' : ''}`} value={f.vehicle_id}
            onChange={e => setF(p => ({ ...p, vehicle_id: e.target.value, odometer_before: '', odometer_after: '' }))}>
            <option value="">- wybierz -</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} - {v.make} {v.model}</option>)}
          </select>
          {errs.vehicle_id && <p className="form-error">{errs.vehicle_id}</p>}
        </div>
        <div>
          <label htmlFor="trip_date" className="form-label">Data wyjazdu <span className="text-red-500">*</span></label>
          <input id="trip_date" type="date" className="form-input" value={f.trip_date}
            onChange={e => setF(p => ({ ...p, trip_date: e.target.value }))} />
        </div>
      </div>
      <div>
        <label htmlFor="purpose" className="form-label">Cel wyjazdu <span className="text-red-500">*</span></label>
        <input id="purpose" type="text" className={`form-input ${errs.purpose ? 'form-input-error' : ''}`} value={f.purpose}
          onChange={e => setF(p => ({ ...p, purpose: e.target.value }))}
          placeholder="np. Spotkanie z klientem ABC Sp. z o.o." />
        {errs.purpose ? <p className="form-error">{errs.purpose}</p>
          : <p className="form-hint">Cel musi potwierdzac sluzbowy charakter wyjazdu (art. 86a ustawy o VAT)</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="route_from" className="form-label">Skad <span className="text-red-500">*</span></label>
          <input id="route_from" type="text" className={`form-input ${errs.route_from ? 'form-input-error' : ''}`} value={f.route_from}
            onChange={e => setF(p => ({ ...p, route_from: e.target.value }))} placeholder="np. Bydgoszcz, ul. Dluga 10" />
          {errs.route_from && <p className="form-error">{errs.route_from}</p>}
        </div>
        <div>
          <label htmlFor="route_to" className="form-label">Dokad <span className="text-red-500">*</span></label>
          <input id="route_to" type="text" className={`form-input ${errs.route_to ? 'form-input-error' : ''}`} value={f.route_to}
            onChange={e => setF(p => ({ ...p, route_to: e.target.value }))} placeholder="np. Warszawa, Al. Jana Pawla II 22" />
          {errs.route_to && <p className="form-error">{errs.route_to}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <input
          type="checkbox"
          id="create_return"
          checked={createReturn}
          onChange={e => setCreateReturn(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="create_return" className="text-sm text-slate-700 select-none cursor-pointer">
          Utwórz wpis powrotny <span className="text-slate-400 text-xs">(ten sam dystans, adresy odwrócone)</span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="odometer_before" className="form-label">Licznik przed wyjazdem <span className="text-red-500">*</span></label>
          <input id="odometer_before" type="number" className={`form-input ${errs.odometer_before ? 'form-input-error' : ''}`}
            value={f.odometer_before} onChange={e => setF(p => ({ ...p, odometer_before: e.target.value }))} />
          {errs.odometer_before && <p className="form-error">{errs.odometer_before}</p>}
        </div>
        <div>
          <label htmlFor="odometer_after" className="form-label">Licznik po powrocie <span className="text-red-500">*</span></label>
          <input id="odometer_after" type="number" className={`form-input ${errs.odometer_after ? 'form-input-error' : ''}`}
            value={f.odometer_after} onChange={e => setF(p => ({ ...p, odometer_after: e.target.value }))} />
          {errs.odometer_after && <p className="form-error">{errs.odometer_after}</p>}
        </div>
        <div>
          <label className="form-label">Km (obliczone)</label>
          <div className={`form-input text-center font-bold ${km === null ? 'bg-slate-50 text-slate-400' : km > 0 ? 'bg-green-50 text-green-700 border-green-300' : 'bg-red-50 text-red-600 border-red-300'}`}>
            {km === null ? '-' : km > 0 ? `${km.toLocaleString('pl-PL')} km` : 'Blad licznika!'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Typ kierowcy</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['internal', 'external'] as const).map(type => (
              <button key={type} type="button" onClick={() => setF(p => ({ ...p, driver_type: type }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${f.driver_type === type ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} ${type === 'external' ? 'border-l border-slate-200' : ''}`}>
                {type === 'internal' ? 'Pracownik' : 'Zewnetrzny'}
              </button>
            ))}
          </div>
        </div>
        {f.driver_type === 'internal' ? (
          <div>
            <label className="form-label">Kierowca <span className="text-red-500">*</span></label>
            <select className="form-input" value={f.driver_id} onChange={e => setF(p => ({ ...p, driver_id: e.target.value }))}>
              <option value="">- wybierz -</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            {errs.driver_id && <p className="form-error">{errs.driver_id}</p>}
          </div>
        ) : (
          <div>
            <label htmlFor="driver_name_external" className="form-label">Imie i nazwisko (zewnetrzny) <span className="text-red-500">*</span></label>
            <input id="driver_name_external" type="text" className={`form-input ${errs.driver_name_external ? 'form-input-error' : ''}`}
              value={f.driver_name_external} onChange={e => setF(p => ({ ...p, driver_name_external: e.target.value }))}
              placeholder="Pelne imie i nazwisko" />
            {errs.driver_name_external && <p className="form-error">{errs.driver_name_external}</p>}
          </div>
        )}
      </div>
      {f.driver_type === 'external' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          &#x26A0; Wpis kierowcy zewnetrznego wymaga potwierdzenia przez spolke (art. 86a ust. 7 pkt 2 lit. b ustawy o VAT).
        </div>
      )}
      <ApiErrorMessage error={error} />
      <div className="flex justify-between items-center pt-2 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
        <button onClick={() => router.back()} className="btn-outline">Anuluj</button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? 'Zapisywanie\u2026' : 'Zapisz wpis'}</button>
      </div>
    </div>
  )
}

function LoanForm({ vehicles, profiles }: { vehicles: Vehicle[]; profiles: Profile[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<DbError | null>(null)
  const [errs,   setErrs]   = useState<Record<string, string>>({})
  const [f, setF] = useState({
    vehicle_id: vehicles[0]?.id ?? '', loan_date: new Date().toISOString().slice(0, 10),
    purpose: '', loaned_to_type: 'external' as 'internal' | 'external',
    loaned_to_user_id: '', loaned_to_name: '', odometer_at_issue: '', notes: '',
  })

  useEffect(() => {
    if (!f.vehicle_id) return
    const veh = vehicles.find(v => v.id === f.vehicle_id)
    if (!veh) return
    getLastOdometer(f.vehicle_id, veh.odometer_start).then(({ odometer }) =>
      setF(p => ({ ...p, odometer_at_issue: String(odometer) }))
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.vehicle_id])

  function validate() {
    const e: Record<string, string> = {}
    if (!f.vehicle_id)  e.vehicle_id  = 'Wybierz pojazd'
    if (!f.loan_date)   e.loan_date   = 'Podaj date'
    if (f.purpose.length < 5) e.purpose = 'Podaj cel (min. 5 znakow)'
    if (!f.odometer_at_issue) e.odometer_at_issue = 'Podaj stan licznika'
    if (f.loaned_to_type === 'external' && !f.loaned_to_name) e.loaned_to_name = 'Podaj imie i nazwisko'
    if (f.loaned_to_type === 'internal' && !f.loaned_to_user_id) e.loaned_to_user_id = 'Wybierz pracownika'
    setErrs(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true); setError(null)
    const effectiveName = f.loaned_to_type === 'internal'
      ? profiles.find(p => p.id === f.loaned_to_user_id)?.full_name ?? ''
      : f.loaned_to_name
    const res = await fetch('/api/loans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id: f.vehicle_id, loan_date: f.loan_date, purpose: f.purpose,
        loaned_to_name: effectiveName,
        loaned_to_user_id: f.loaned_to_type === 'internal' ? f.loaned_to_user_id : undefined,
        odometer_at_issue: parseInt(f.odometer_at_issue, 10),
        notes: f.notes || undefined,
      }),
    })
    const d = await res.json()
    if (!res.ok) {
      setError(d.code ? d : { code: 'db_error', message: d.error ?? 'Blad zapisu', hint: '' })
      setSaving(false); return
    }
    setSaved(true); setTimeout(() => router.push('/wpisy'), 1200)
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-3xl">&#x2713;</div>
      <h2 className="text-lg font-semibold text-slate-800">Udostepnienie zapisane</h2>
      <p className="text-sm text-slate-400">Przekierowuje&hellip;</p>
    </div>
  )

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Pojazd <span className="text-red-500">*</span></label>
          <select className={`form-input ${errs.vehicle_id ? 'form-input-error' : ''}`} value={f.vehicle_id}
            onChange={e => setF(p => ({ ...p, vehicle_id: e.target.value }))}>
            <option value="">- wybierz -</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} - {v.make} {v.model}</option>)}
          </select>
          {errs.vehicle_id && <p className="form-error">{errs.vehicle_id}</p>}
        </div>
        <div>
          <label className="form-label">Data udostepnienia <span className="text-red-500">*</span></label>
          <input type="date" className="form-input" value={f.loan_date}
            onChange={e => setF(p => ({ ...p, loan_date: e.target.value }))} />
          {errs.loan_date && <p className="form-error">{errs.loan_date}</p>}
        </div>
      </div>
      <div>
        <label className="form-label">Cel udostepnienia <span className="text-red-500">*</span></label>
        <input type="text" className={`form-input ${errs.purpose ? 'form-input-error' : ''}`} value={f.purpose}
          onChange={e => setF(p => ({ ...p, purpose: e.target.value }))}
          placeholder="np. Wyjazd sluzbowy do klienta XYZ" />
        {errs.purpose ? <p className="form-error">{errs.purpose}</p>
          : <p className="form-hint">Cel musi potwierdzac sluzbowy charakter uzytkowania (art. 86a ustawy o VAT)</p>}
      </div>
      <div className="space-y-2">
        <label className="form-label">Udostepniono <span className="text-red-500">*</span></label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['external', 'internal'] as const).map(type => (
            <button key={type} type="button"
              onClick={() => setF(p => ({ ...p, loaned_to_type: type, loaned_to_name: '', loaned_to_user_id: '' }))}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${f.loaned_to_type === type ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'} ${type === 'internal' ? 'border-l border-slate-200' : ''}`}>
              {type === 'external' ? 'Osobie zewnetrznej' : 'Pracownikowi'}
            </button>
          ))}
        </div>
        {f.loaned_to_type === 'external' ? (
          <div>
            <input type="text" className={`form-input ${errs.loaned_to_name ? 'form-input-error' : ''}`}
              value={f.loaned_to_name} onChange={e => setF(p => ({ ...p, loaned_to_name: e.target.value }))}
              placeholder="Imie i nazwisko osoby" />
            {errs.loaned_to_name && <p className="form-error">{errs.loaned_to_name}</p>}
          </div>
        ) : (
          <div>
            <select className={`form-input ${errs.loaned_to_user_id ? 'form-input-error' : ''}`}
              value={f.loaned_to_user_id} onChange={e => setF(p => ({ ...p, loaned_to_user_id: e.target.value }))}>
              <option value="">- wybierz pracownika -</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
            {errs.loaned_to_user_id && <p className="form-error">{errs.loaned_to_user_id}</p>}
          </div>
        )}
      </div>
      <div>
        <label className="form-label">Stan licznika przy wydaniu <span className="text-red-500">*</span></label>
        <input type="number" className={`form-input ${errs.odometer_at_issue ? 'form-input-error' : ''}`}
          value={f.odometer_at_issue} onChange={e => setF(p => ({ ...p, odometer_at_issue: e.target.value }))} placeholder="km" />
        {errs.odometer_at_issue ? <p className="form-error">{errs.odometer_at_issue}</p>
          : <p className="form-hint">Stan licznika przy zwrocie uzupelnisz po powrocie pojazdu</p>}
      </div>
      <div>
        <label className="form-label">Notatka <span className="text-slate-400 font-normal">(opcjonalnie)</span></label>
        <textarea className="form-input resize-none" rows={2} value={f.notes}
          onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
          placeholder="Dodatkowe informacje&hellip;" maxLength={1000} />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
        &#x2139; Wpis zostanie zapisany jako <strong>udostepnienie</strong> w ewidencji (art. 86a ust. 7 pkt 2 lit. c ustawy o VAT).
      </div>
      <ApiErrorMessage error={error} />
      <div className="flex justify-between items-center pt-2 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
        <button onClick={() => router.back()} className="btn-outline">Anuluj</button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary">{saving ? 'Zapisywanie\u2026' : 'Zapisz udostepnienie'}</button>
      </div>
    </div>
  )
}

export default function NowyWpisPage() {
  const [tab,      setTab]      = useState<'wyjazd' | 'udostepnienie'>('wyjazd')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    loadVehiclesAndProfiles().then(({ vehicles, profiles }) => {
      setVehicles(vehicles); setProfiles(profiles); setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nowy wpis ewidencji" />
      <div className="main-scroll p-5">
        <div className="card max-w-3xl mx-auto">
          <div className="flex border-b border-slate-200">
            {(['wyjazd', 'udostepnienie'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${t === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {t === 'wyjazd' ? 'Wyjazd wlasny' : 'Udostepnienie pojazdu'}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Ladowanie danych&hellip;</div>
          ) : tab === 'wyjazd' ? (
            <TripForm vehicles={vehicles} profiles={profiles} />
          ) : (
            <LoanForm vehicles={vehicles} profiles={profiles} />
          )}
        </div>
      </div>
    </div>
  )
}
