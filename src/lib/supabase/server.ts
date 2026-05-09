import { createServerClient } from '@supabase/ssr'
import { createClient as createPlainClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Standardowy klient — używa cookies sesji usera. Operacje są autoryzowane
 * jako zalogowany user (rola `authenticated`), RLS jest egzekwowane,
 * dostęp ograniczony do schematów wystawionych w PostgREST API.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    },
  )
}

/**
 * Admin klient — używa service_role key BEZ cookies.
 *
 * Service role omija RLS i ma dostęp do wszystkich schematów (włącznie
 * z auth_hub, który nie jest exposed w PostgREST API).
 *
 * UWAGA: NIE używamy tutaj createServerClient z @supabase/ssr — ten
 * klient czyta cookies sesji usera, co przy service_role key prowadzi
 * do niezdefiniowanego zachowania (klient miesza tożsamości). Używamy
 * podstawowego createClient z @supabase/supabase-js, bez auth helperów.
 *
 * Uprawnienia muszą być sprawdzone PRZED użyciem tego klienta —
 * service_role omija RLS, więc cała kontrola dostępu spoczywa na kodzie
 * aplikacyjnym (np. ensureGlobalAdmin w whitelist endpoint).
 */
export function createAdminClient(): SupabaseClient {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
