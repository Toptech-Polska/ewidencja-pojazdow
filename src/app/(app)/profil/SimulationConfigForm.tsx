'use client'

import { useState, useRef } from 'react'
import type { SimulationLocation, SimulationLocationType, SimulationConfig } from '@/types/database'

const TYPE_LABELS: Record<SimulationLocationType, string> = {
  siedziba: 'Siedziba firmy',
  dom:      'Dom / miejsce zamieszkania',
  klient:   'Klient',
  inne:     'Inne',
}

const TYPE_COLORS: Record<SimulationLocationType, string> = {
  siedziba: 'bg-blue-50 text-blue-700',
  dom:      'bg-green-50 text-green-700',
  klient:   'bg-purple-50 text-purple-700',
  inne:     'bg-slate-100 text-slate-600',
}

interface Prediction {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

function AddressInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length < 3) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(v)}`)
        const data = await res.json()
        setSuggestions(data.predictions ?? [])
        setOpen(true)
      } catch { /* ignore */ }
    }, 300)
  }

  function select(description: string) {
    onChange(description)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text" className="form-input" value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Wpisz adres..."
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {suggestions.map(s => (
            <button
              key={s.place_id} type="button"
              onClick={() => select(s.description)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
            >
              <p className="font-medium text-slate-800 truncate">{s.main_text}</p>
              <p className="text-xs text-slate-500 truncate">{s.secondary_text}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  profileId: string
  initialConfig: SimulationConfig | null
}

export function SimulationConfigForm({ profileId, initialConfig }: Props) {
  const [locations, setLocations] = useState<SimulationLocation[]>(initialConfig?.locations ?? [])
  const [showForm, setShowForm]   = useState(false)
  const [saving,   setSaving]     = useState(false)
  const [saved,    setSaved]      = useState(false)
  const [saveErr,  setSaveErr]    = useState<string | null>(null)
  const [form, setForm] = useState({ label: '', address: '', type: 'inne' as SimulationLocationType })

  function addLocation() {
    if (!form.label.trim() || !form.address.trim()) return
    setLocations(prev => [...prev, { id: crypto.randomUUID(), label: form.label.trim(), address: form.address.trim(), type: form.type }])
    setForm({ label: '', address: '', type: 'inne' })
    setShowForm(false)
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null); setSaved(false)
    const res = await fetch(`/api/profiles/${profileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulation_config: { locations } }),
    })
    if (!res.ok) {
      const d = await res.json()
      setSaveErr(d.error ?? 'Blad zapisu')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      {locations.length < 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          &#x26A0; Dodaj co najmniej 2 lokalizacje, aby korzystac z generatora symulacji.
        </div>
      )}

      {locations.length > 0 && (
        <div className="space-y-2">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TYPE_COLORS[loc.type]}`}>
                    {TYPE_LABELS[loc.type]}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">{loc.label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{loc.address}</p>
              </div>
              <button
                onClick={() => setLocations(prev => prev.filter(l => l.id !== loc.id))}
                className="text-slate-400 hover:text-red-500 text-lg leading-none flex-shrink-0"
              >&times;</button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50/30">
          <p className="text-xs font-semibold text-slate-600">Nowa lokalizacja</p>
          <div>
            <label className="form-label">Typ</label>
            <select className="form-input" value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as SimulationLocationType }))}>
              {(Object.entries(TYPE_LABELS) as [SimulationLocationType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Nazwa wyswietlana</label>
            <input type="text" className="form-input" value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="np. Siedziba firmy / Klient ABC Sp. z o.o." />
          </div>
          <div>
            <label className="form-label">Adres</label>
            <AddressInput value={form.address} onChange={v => setForm(p => ({ ...p, address: v }))} />
            <p className="form-hint">Wybierz adres z listy podpowiedzi lub wpisz recznie.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setForm({ label: '', address: '', type: 'inne' }) }}
              className="btn-outline text-xs py-1.5 px-3">Anuluj</button>
            <button onClick={addLocation} disabled={!form.label.trim() || !form.address.trim()}
              className="btn-primary text-xs py-1.5 px-3">Dodaj lokalizacje</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full border-2 border-dashed border-slate-200 rounded-lg py-3 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
          + Dodaj lokalizacje
        </button>
      )}

      {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Zapisywanie...' : 'Zapisz konfiguracje'}
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">&#x2713; Zapisano</span>}
      </div>
    </div>
  )
}
