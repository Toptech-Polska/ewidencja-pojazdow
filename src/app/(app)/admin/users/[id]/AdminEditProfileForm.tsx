'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  administrator: 'Administrator',
  ksiegowosc:    'Ksiegowosc',
  kierowca:      'Kierowca',
  kontrola:      'Kontrola',
}

interface Props {
  profile: Profile
}

export function AdminEditProfileForm({ profile }: Props) {
  const router = useRouter()
  const [f, setF] = useState({
    full_name: profile.full_name,
    role:      profile.role,
    is_active: profile.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    if (f.full_name.trim().length < 2) return
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: f.full_name.trim(), role: f.role, is_active: f.is_active }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Blad zapisu'); setSaving(false); return }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Blad polaczenia z serwerem')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Imie i nazwisko</label>
        <input type="text" className="form-input" value={f.full_name} maxLength={200}
          onChange={e => setF(p => ({ ...p, full_name: e.target.value }))} />
      </div>

      <div>
        <label className="form-label">Rola</label>
        <select className="form-input" value={f.role}
          onChange={e => setF(p => ({ ...p, role: e.target.value as UserRole }))}>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Status konta</label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.is_active}
              onChange={e => setF(p => ({ ...p, is_active: e.target.checked }))} />
            <span className="text-sm text-slate-700">
              {f.is_active ? 'Konto aktywne' : 'Konto nieaktywne'}
            </span>
          </label>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
          Profil zaktualizowany.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
      </button>
    </div>
  )
}
