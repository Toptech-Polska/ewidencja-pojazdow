import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { AllowedEmail } from '@/types/database'

/**
 * Pomocnicze funkcje dla operacji na auth_hub.
 *
 * Schemat auth_hub jest celowo niedostępny przez REST API (anon klient
 * nie ma USAGE na schemacie). Wszystkie operacje na nim idą przez
 * admin klienta z service_role key. Każda funkcja sama weryfikuje
 * uprawnienia zalogowanego usera przez RPC public.is_global_admin().
 */

/**
 * Sprawdza, czy aktualnie zalogowany user jest globalnym adminem
 * Auth Hub (ma rolę 'admin' w auth_hub.user_app_roles).
 */
export async function isCurrentUserGlobalAdmin(): Promise<boolean> {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return false

  const { data, error } = await userClient.rpc('is_global_admin')
  if (error) return false
  return !!data
}

/**
 * Pobiera całą listę whitelist (tylko dla globalnego admina).
 * Zwraca pustą tablicę jeśli user nie ma uprawnień — wywołujący
 * powinien sprawdzić uprawnienia osobno przez isCurrentUserGlobalAdmin().
 */
export async function fetchWhitelist(): Promise<AllowedEmail[]> {
  const isAdmin = await isCurrentUserGlobalAdmin()
  if (!isAdmin) return []

  // createAdminClient nie jest async (nie używa cookies)
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .schema('auth_hub')
    .from('allowed_emails')
    .select('email, added_by, added_at, is_active, note')
    .order('added_at', { ascending: false })

  if (error) {
    console.error('fetchWhitelist error:', error)
    return []
  }
  return (data ?? []) as AllowedEmail[]
}
