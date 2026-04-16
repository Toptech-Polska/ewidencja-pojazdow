'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nieprawidłowy email lub hasło')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold text-lg">
          KM
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-lg leading-tight">EwidencjaVAT</p>
          <p className="text-xs text-slate-500">art. 86a ustawy o VAT</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Zaloguj się</h1>
        <p className="text-sm text-slate-500 mb-6">Toptech Polska Sp. z o.o.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="form-label">
              Adres email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="jan.nowak@toptech.pl"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label">
              Hasło <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center flex items-center gap-2 py-2.5"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Logowanie…
              </>
            ) : 'Zaloguj się'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Problemy z logowaniem? Skontaktuj się z administratorem.
      </p>
    </div>
  )
}
