import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Zarządzanie whitelist auth_hub.allowed_emails
//
// Schemat auth_hub jest celowo NIE-exposed w PostgREST API — czyli
// klient anon (z poziomu przeglądarki) nie ma do niego dostępu.
// Wszystkie operacje idą przez backend, używając admin klienta z
// service_role key (omija RLS i exposed schemas).
//
// Uprawnienia weryfikujemy przez RPC `public.is_global_admin()`
// (SECURITY DEFINER), które sprawdza czy zalogowany user ma rolę
// 'admin' w auth_hub.user_app_roles — niezależnie od tego, że nie ma
// bezpośredniego dostępu do tego schematu.

const AddEmailSchema = z.object({
  email: z.string().email('Nieprawidłowy format email').toLowerCase(),
  note:  z.string().max(500).optional(),
})

const UpdateEmailSchema = z.object({
  email:     z.string().email().toLowerCase(),
  is_active: z.boolean().optional(),
  note:      z.string().max(500).nullable().optional(),
})

/**
 * Weryfikuje, że request idzie od zalogowanego globalnego admina.
 * Zwraca admin client (z service_role) gotowy do operacji na auth_hub,
 * email zalogowanego usera (do wpisu added_by), albo NextResponse z błędem.
 */
async function ensureGlobalAdmin() {
  // Najpierw zwykły klient — żeby pobrać sesję usera z cookies
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // Sprawdź uprawnienia globalnego admina przez RPC (działa pomimo niedostępności schematu)
  const { data: isAdmin, error: rpcError } = await userClient.rpc('is_global_admin')
  if (rpcError) {
    return { error: NextResponse.json({ error: 'Błąd sprawdzania uprawnień: ' + rpcError.message }, { status: 500 }) }
  }
  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Wymagane uprawnienia globalnego admina Auth Hub' }, { status: 403 }) }
  }

  // Wszystko OK — zwróć admin client do operacji na auth_hub
  const adminClient = await createAdminClient()
  return { adminClient, userEmail: user.email ?? user.id }
}

/**
 * GET — lista wszystkich emaili na whitelist.
 * Odczyt też wymaga globalnego admina (whitelist zawiera dane osobowe pracowników).
 */
export async function GET() {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error

  const { data, error } = await guard.adminClient
    .schema('auth_hub')
    .from('allowed_emails')
    .select('email, added_by, added_at, is_active, note')
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

/**
 * POST — dodaj nowy email do whitelist.
 */
export async function POST(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error

  const body = await req.json()
  const parsed = AddEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { error } = await guard.adminClient
    .schema('auth_hub')
    .from('allowed_emails')
    .insert({
      email:     parsed.data.email,
      note:      parsed.data.note ?? null,
      added_by:  guard.userEmail,
      is_active: true,
    })

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ten email jest już na whitelist' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

/**
 * PATCH — zmień is_active lub note.
 */
export async function PATCH(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error

  const body = await req.json()
  const parsed = UpdateEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active
  if (parsed.data.note !== undefined)      updateData.note = parsed.data.note

  const { error } = await guard.adminClient
    .schema('auth_hub')
    .from('allowed_emails')
    .update(updateData)
    .eq('email', parsed.data.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

/**
 * DELETE — twardo usuń wpis (rzadko; zwykle wystarczy is_active=false).
 */
export async function DELETE(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Brak parametru email' }, { status: 422 })

  const { error } = await guard.adminClient
    .schema('auth_hub')
    .from('allowed_emails')
    .delete()
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
