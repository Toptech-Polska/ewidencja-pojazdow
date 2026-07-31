'use client'

import { useState } from 'react'
import type { Company } from '@/types/database'

interface Props {
  companies: Company[]
}

const EMPTY_FORM = { name: '', nip: '', krs: '', regon: '', address: '' }

export function CompaniesManager({ companies: initial }: Props) {
  const [companies, setCompanies] = useState<Company[]>(initial)
  const [editing, setEditing]     = useState<Company | null>(null)
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function startAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setAdding(true)
  }

  function startEdit(c: Company) {
    setAdding(false)
    setError(null)
    setForm({ name: c.name, nip: c.nip, krs: c.krs ?? '', regon: c.regon ?? '', address: c.address ?? '' })
    setEditing(c)
  }

  function cancel() {
    setAdding(false)
    setEditing(null)
    setError(null)
  }

  async function save() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/companies', {
        method:  editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editing ? { id: editing.id, ...form } : form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd zapisu'); return }

      if (editing) {
        setCompanies(prev => prev.map(c => c.id === editing.id ? data : c))
      } else {
        setCompanies(prev => [...prev, data])
      }
      cancel()
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="divide-y divide-slate-100">
        {companies.map(c => (
          <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                NIP: {c.nip}
                {c.krs    && <> &middot; KRS: {c.krs}</>}
                {c.regon  && <> &middot; REGON: {c.regon}</>}
              </p>
              {c.address && <p className="text-xs text-slate-400 mt-0.5">{c.address}</p>}
            </div>
            <button
              onClick={() => startEdit(c)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
            >
              Edytuj
            </button>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-3 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {editing ? 'Edytuj podmiot' : 'Nowy podmiot'}
          </p>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Pełna nazwa prawna <span className="text-red-500">*</span></label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. TOPTECH Polska Spółka z o.o." />
            </div>
            <div>
              <label className="form-label">NIP <span className="text-red-500">*</span></label>
              <input className="form-input font-mono" value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} placeholder="9252151335" maxLength={10} />
            </div>
            <div>
              <label className="form-label">KRS</label>
              <input className="form-input font-mono" value={form.krs} onChange={e => setForm(f => ({ ...f, krs: e.target.value }))} placeholder="0001214393" maxLength={10} />
            </div>
            <div>
              <label className="form-label">REGON</label>
              <input className="form-input font-mono" value={form.regon} onChange={e => setForm(f => ({ ...f, regon: e.target.value }))} placeholder="542685142" maxLength={14} />
            </div>
            <div>
              <label className="form-label">Adres siedziby</label>
              <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ul. Inżynierska 8, 67-100 Nowa Sól" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancel} className="btn-outline text-xs">Anuluj</button>
            <button onClick={save} disabled={loading || !form.name || !form.nip} className="btn-primary text-xs">
              {loading ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj podmiot'}
            </button>
          </div>
        </div>
      )}

      {!adding && !editing && (
        <div className="px-4 py-3 border-t border-slate-100">
          <button onClick={startAdd} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            + Dodaj podmiot
          </button>
        </div>
      )}
    </div>
  )
}
