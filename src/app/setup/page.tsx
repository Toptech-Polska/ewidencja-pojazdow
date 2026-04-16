'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /setup — jednorazowe tworzenie pierwszego konta administratora.
 * Po użyciu usuń plik lub ogranicz dostęp przez middleware.
 */
export default function SetupPage() {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({
    email: '', password: '', fullName: '',
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? '',
    nip: process.env.NEXT_PUBLIC_COMPANY_NIP ?? '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr('')

    // Call via API to keep service_role key on server
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setErr(data.error ?? 'Błąd tworzenia konta')
      setLoading(false)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-3xl mx-auto">✓</div>
        <h2 className="text-xl font-semibold text-slate-800">Konfiguracja zakończona!</h2>
        <p className="text-sm text-slate-500">Przekierowuję do logowania…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold text-lg">KM</div>
          <div>
            <p className="font-semibold text-slate-900 text-lg">EwidencjaVAT — Konfiguracja</p>
            <p className="text-xs text-slate-500">Pierwsze uruchomienie</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Utwórz konto administratora</h1>
          <p className="text-sm text-slate-500 mb-6">Ta strona jest dostępna tylko raz — po konfiguracji usuń lub zablokuj /setup.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Nazwa spółki</label>
              <input className="form-input" value={f.companyName} onChange={e => setF(p => ({...p, companyName: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">NIP spółki</label>
              <input className="form-input" value={f.nip} onChange={e => setF(p => ({...p, nip: e.target.value}))} required />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <label className="form-label">Imię i nazwisko administratora</label>
              <input className="form-input" value={f.fullName} onChange={e => setF(p => ({...p, fullName: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={f.email} onChange={e => setF(p => ({...p, email: e.target.value}))} required />
            </div>
            <div>
              <label className="form-label">Hasło (min. 8 znaków)</label>
              <input type="password" className="form-input" value={f.password} onChange={e => setF(p => ({...p, password: e.target.value}))} minLength={8} required />
            </div>

            {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">{err}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex py-2.5">
              {loading ? 'Tworzenie konta…' : 'Utwórz konto i uruchom aplikację'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
