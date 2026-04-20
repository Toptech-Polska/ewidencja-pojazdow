'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  ksiegowosc:    'Księgowość',
  kierowca:      'Kierowca',
  kontrola:      'Kontrola',
}
const ROLE_BADGE: Record<UserRole, string> = {
  administrator: 'badge-info',
  ksiegowosc:    'badge-warn',
  kierowca:      'badge-gray',
  kontrola:      'badge-info',
}

interface EditState {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
}

export function AdminUsersClient({ profiles }: { profiles: Profile[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function startEdit(p: Profile) {
    setEditing({ id: p.id, full_name: p.full_name, role: p.role, is_active: p.is_active })
    setError(null)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/profiles/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editing.full_name,
          role:      editing.role,
          is_active: editing.is_active,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd zapisu'); setSaving(false); return }
      setEditing(null)
      router.refresh()
    } catch {
      setError('Błąd połączenia z serwerem')
    }
    setSaving(false)
  }

  return (
    <>
      {error && (
        <div className="mx-0 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Użytkownik</th><th>Email</th><th>Rola</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => {
            const initials = p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const isEditing = editing?.id === p.id

            return (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {initials}
                    </div>
                    {isEditing ? (
                      <input
                        className="form-input py-1 text-sm"
                        value={editing.full_name}
                        onChange={e => setEditing(prev => prev ? { ...prev, full_name: e.target.value } : prev)}
                      />
                    ) : (
                      <span className="font-semibold text-slate-800">{p.full_name}</span>
                    )}
                  </div>
                </td>
                <td className="text-slate-500 text-xs">{p.email}</td>
                <td>
                  {isEditing ? (
                    <select
                      className="form-input py-1 text-sm"
                      value={editing.role}
                      onChange={e => setEditing(prev => prev ? { ...prev, role: e.target.value as UserRole } : prev)}
                    >
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`badge ${ROLE_BADGE[p.role]}`}>{ROLE_LABELS[p.role]}</span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editing.is_active}
                        onChange={e => setEditing(prev => prev ? { ...prev, is_active: e.target.checked } : prev)}
                      />
                      <span className="text-xs">{editing.is_active ? 'Aktywny' : 'Nieaktywny'}</span>
                    </label>
                  ) : (
                    p.is_active
                      ? <span className="badge badge-ok">Aktywny</span>
                      : <span className="badge badge-gray">Nieaktywny</span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="text-xs text-white bg-blue-700 hover:bg-blue-800 font-medium px-2 py-1 rounded"
                      >
                        {saving ? '…' : 'Zapisz'}
                      </button>
                      <button
                        onClick={() => { setEditing(null); setError(null) }}
                        className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edytuj
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
          {!profiles.length && (
            <tr><td colSpan={5} className="text-center text-slate-400 py-6 text-sm">Brak użytkowników</td></tr>
          )}
        </tbody>
      </table>
    </>
  )
}
