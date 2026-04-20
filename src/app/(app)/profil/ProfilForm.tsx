'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'

export function ProfilForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.full_name)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [nameErr,  setNameErr]  = useState<string | null>(null)

  async function handleSave() {
    if (fullName.trim().length < 2) {
      setNameErr('Imię i nazwisko musi mieć co najmniej 2 znaki')
      return
    }
    setNameErr(null); setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd zapisu'); setSaving(false); return }
      setSaved(true)
      router.refresh()
    } catch {
      setError('Błąd połączenia z serwerem')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="form-label">Imię i nazwisko</label>
        <input
          type="text"
          className={`form-input ${nameErr ? 'form-input-error' : ''}`}
          value={fullName}
          onChange={e => { setFullName(e.target.value); setNameErr(null); setSaved(false) }}
          maxLength={200}
        />
        {nameErr && <p className="form-error">{nameErr}</p>}
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
          Profil zaktualizowany.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || fullName.trim() === profile.full_name}
        className="btn-primary"
      >
        {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
      </button>
    </div>
  )
}
