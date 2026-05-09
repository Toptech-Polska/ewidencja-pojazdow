'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AllowedEmail } from '@/types/database'

export function WhitelistManager({
  whitelist,
  isGlobalAdmin,
}: {
  whitelist: AllowedEmail[]
  isGlobalAdmin: boolean
}) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [newNote,  setNewNote]  = useState('')
  const [adding,   setAdding]   = useState(false)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!newEmail.trim()) return
    setAdding(true); setError(null)
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), note: newNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd dodawania'); setAdding(false); return }
      setNewEmail(''); setNewNote('')
      router.refresh()
    } catch {
      setError('Błąd połączenia z serwerem')
    }
    setAdding(false)
  }

  async function toggleActive(email: string, currentActive: boolean) {
    setBusyEmail(email); setError(null)
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, is_active: !currentActive }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd zmiany statusu') }
      else router.refresh()
    } catch {
      setError('Błąd połączenia z serwerem')
    }
    setBusyEmail(null)
  }

  return (
    <>
      <div className="px-0 pb-3 space-y-1">
        <p className="text-xs text-slate-500">
          Whitelist jest <strong>globalny</strong> dla wszystkich aplikacji Toptech (Auth Hub).
          Dodanie lub dezaktywacja emaila wpływa na każdą aplikację korzystającą z tego
          systemu logowania, nie tylko ewidencję pojazdów.
        </p>
        {!isGlobalAdmin && (
          <p className="text-xs text-amber-700">
            Nie masz uprawnień globalnego admina — możesz tylko podejrzeć whitelist.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {isGlobalAdmin && (
        <div className="flex gap-2 items-end mb-4 px-0">
          <div className="flex-1">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="imie.nazwisko@toptechpolska.pl"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="form-label">Notatka (opcjonalnie)</label>
            <input
              type="text"
              className="form-input"
              placeholder="np. księgowa, kierowca"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
          </div>
          <button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="btn-primary text-sm">
            {adding ? 'Dodawanie…' : '+ Dodaj do whitelist'}
          </button>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th><th>Notatka</th><th>Dodał(a)</th><th>Status</th>
            {isGlobalAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {whitelist.map(w => (
            <tr key={w.email}>
              <td className="font-mono text-xs text-slate-800">{w.email}</td>
              <td className="text-xs text-slate-500">{w.note ?? '—'}</td>
              <td className="text-xs text-slate-500">{w.added_by ?? '—'}</td>
              <td>
                {w.is_active
                  ? <span className="badge badge-ok">Aktywny</span>
                  : <span className="badge badge-gray">Wyłączony</span>}
              </td>
              {isGlobalAdmin && (
                <td>
                  <button
                    onClick={() => toggleActive(w.email, w.is_active)}
                    disabled={busyEmail === w.email}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                    {busyEmail === w.email
                      ? '...'
                      : w.is_active ? 'Wyłącz' : 'Aktywuj'}
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!whitelist.length && (
            <tr>
              <td colSpan={isGlobalAdmin ? 5 : 4} className="text-center text-slate-400 py-6 text-sm">
                Whitelist jest pusta
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
