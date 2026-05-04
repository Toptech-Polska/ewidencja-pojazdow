# CLAUDE.md — Ewidencja Pojazdów: Migracja auth na Google OAuth + auth_hub whitelist

## Cel zadania

Zastąp istniejące logowanie e-mail/hasło **wyłącznie logowaniem przez Google OAuth**.
Dostęp tylko dla adresów email zatwierdzonych w tabeli `auth_hub.allowed_emails` w Supabase.

Nie zmieniaj żadnej logiki biznesowej, stylów, komponentów ani innych stron aplikacji.

---

## Stack i kluczowa różnica

Ta aplikacja to **Next.js App Router** z serwerowym middleware — NIE Vite SPA.
Auth callback to prawdziwy endpoint serwerowy (`route.ts`), nie strona React.
Sprawdzenie whitelist dzieje się po stronie **serwera**, nie klienta.

---

## Supabase — projekt i tabele

- **Projekt:** `cukohoqgvcsvmopvivjt` — już skonfigurowany w `.env.local`, Google OAuth włączony
- **Tabela whitelist:** `auth_hub.allowed_emails` (kolumny: `email TEXT`, `is_active BOOLEAN`)
- **Tabela ról:** `auth_hub.user_app_roles` (kolumny: `user_id UUID`, `app TEXT`, `role TEXT`)
- **App identifier dla tej aplikacji:** `'vat_km'`
- **Dane aplikacji:** schemat `vat_km` — już w tym samym projekcie Supabase

---

## Co zmienić

### 1. `src/app/(auth)/login/page.tsx` — ZASTĄP całą zawartość

Nowa strona logowania:
- Usuń formularz email/hasło całkowicie
- Dodaj jeden przycisk "Zaloguj się przez Google" wywołujący Server Action lub `signInWithOAuth` po stronie klienta
- Zachowaj istniejący styl (logo KM, `bg-white rounded-2xl`, kolory slate)
- Jeśli URL zawiera `?error=unauthorized` — wyświetl komunikat: "Twój adres email nie ma dostępu do tej aplikacji. Skontaktuj się z administratorem."

Implementacja przycisku Google (client component):
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export function GoogleLoginButton() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button onClick={handleLogin} className="btn-primary w-full ...">
      <GoogleIcon />
      Zaloguj się przez Google
    </button>
  )
}
```

---

### 2. `src/app/auth/callback/route.ts` — UTWÓRZ NOWY

Serwerowy endpoint obsługujący powrót z Google OAuth.
Sprawdza whitelist i wpuszcza lub odrzuca użytkownika.

```typescript
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Wymień code na sesję
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_error`)
  }

  // Pobierz zalogowanego użytkownika
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Sprawdź whitelist w auth_hub
  const { data: allowed } = await supabase
    .rpc('check_email_allowed', { p_email: user.email })

  if (!allowed) {
    // Email nie na whitelist — wyloguj i przekieruj z błędem
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unauthorized`)
  }

  // Wpuść użytkownika
  return NextResponse.redirect(`${origin}/dashboard`)
}
```

---

### 3. `src/lib/supabase/middleware.ts` — BEZ ZMIAN

Middleware już poprawnie:
- odświeża sesję
- przekierowuje niezalogowanych na `/login`
- przekierowuje zalogowanych z `/login` na `/dashboard`

Upewnij się tylko że `/auth/callback` jest wykluczony z matchera w `src/middleware.ts` — dodaj `auth/callback` do listy ignorowanych ścieżek:

```typescript
// src/middleware.ts — zaktualizuj matcher:
'/((?!_next/static|_next/image|favicon.ico|setup|api/setup|api/auth|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
```

---

### 4. Czego NIE zmieniać

- `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` — bez zmian
- Wszystkie strony w `src/app/(app)/` — bez zmian
- Style, Tailwind config — bez zmian
- `next.config.mjs`, `tsconfig.json` — bez zmian
- Zmienne środowiskowe w `.env.local` — Supabase URL już wskazuje na Auth Hub, bez zmian

---

## Weryfikacja po implementacji

1. `npm run build` musi przejść bez błędów TypeScript
2. `npm run dev` — wejdź na `http://localhost:3000`
3. Powinien pokazać się ekran logowania z przyciskiem Google (bez formularza email/hasło)
4. Kliknięcie przycisku → Google → powrót na `/auth/callback` → whitelist check → `/dashboard`
5. Email spoza whitelist → wylogowanie → `/login?error=unauthorized` → komunikat o braku dostępu

---

## Uruchomienie Claude Code

Sklonuj repo lokalnie, następnie:

```bash
cd ewidencja-pojazdow
npm install
```

Wklej do Claude Code:
```
Przeczytaj CLAUDE.md i zaimplementuj system logowania zgodnie ze specyfikacją.
Kolejność: 1) zaktualizuj src/middleware.ts matcher, 2) utwórz src/app/auth/callback/route.ts,
3) zastąp src/app/(auth)/login/page.tsx. Na końcu uruchom npm run build.
```
