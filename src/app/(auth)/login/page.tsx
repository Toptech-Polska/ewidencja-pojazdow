'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sun, Moon } from 'lucide-react'
import Image from 'next/image'

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized:
    'Twoje konto Google nie ma dostępu do tej aplikacji. Skontaktuj się z administratorem.',
  auth_callback_error: 'Błąd uwierzytelnienia. Spróbuj zalogować się ponownie.',
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error') ?? ''
  const errorMessage = ERROR_MESSAGES[errorParam] ?? null

  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = (localStorage.getItem('login-theme') as 'light' | 'dark' | null) ?? 'light'
    setTheme(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem('login-theme', theme)
  }, [theme, mounted])

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://pojazdy.tsps.pl/auth/callback',
      },
    })
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950 transition-colors relative">
        <button
          type="button"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          aria-label="Przełącz motyw"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex justify-center mb-8">
            <Image
              src="/toptech-logo.svg"
              alt="TOPTECH"
              width={200}
              height={30}
              className="h-9 w-auto dark:brightness-0 dark:invert"
              priority
            />
          </div>

          <p className="text-center mb-8 text-slate-500 dark:text-slate-400 text-sm">
            Zaloguj się do raportowania podróży km
          </p>

          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 h-11 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-600 transition-all"
          >
            <GoogleIcon />
            Zaloguj się przez Google
          </button>
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-400 dark:text-slate-500">
          Problemy z logowaniem? Skontaktuj się z administratorem.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
