import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Zarządzanie whitelist auth_hub.allowed_emails
//
// UWAGA: Whitelist jest GLOBALNY dla wszystkich aplikacji Toptech (Auth Hub).
// Dodanie/usunięcie emaila wpływa na każdą aplikację korzystającą z tej tabeli.
//
// Uprawnienia: tylko user z auth_hub.user_app_roles.role = 'admin'
// (egzekwowane przez RLS na auth_hub.allowed_emails).

const AddEmailSchema = z.object({
  email: z.string().email('Nieprawidłowy format email').toLowerCase(),
  note:  z.string().max(500).optional(),
})

const UpdateEmailSchema = z.object({
  email:     z.string().email().toLowerCase(),
  is_active: z.boolean().optional(),
  note:      z.string().max(500).nullable().optional(),
})

async function ensureGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Globalny admin Auth Hub = ktokolwiek z user_app_roles.role = 'admin'
  const { data: roles } = await supabase
    .schema('auth_hub')
    .from('user_app_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)

  if (!roles || roles.length === 0) {
    return { error: NextResponse.json({ error: 'Wymagane uprawnienia globalnego admina Auth Hub' }, { status: 403 }) }
  }

  return { supabase, user }
}

// GET — lista wszystkich emaili na whitelist
export async function GET() {
  const supabase = (await createClient())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS: każdy zalogowany czyta whitelist
  const { data, error } = await supabase
    .schema('auth_hub')
    .from('allowed_emails')
    .select('email, added_by, added_at, is_active, note')
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST — dodaj nowy email
export async function POST(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error
  const { supabase, user } = guard

  const body = await req.json()
  const parsed = AddEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const { error } = await supabase
    .schema('auth_hub')
    .from('allowed_emails')
    .insert({
      email:     parsed.data.email,
      note:      parsed.data.note ?? null,
      added_by:  user.email ?? user.id,
      is_active: true,
    })

  if (error) {
    // Duplikat = unikalny constraint na email (kod 23505)
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'Ten email jest już na whitelist' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

// PATCH — zmień is_active lub note
export async function PATCH(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error
  const { supabase } = guard

  const body = await req.json()
  const parsed = UpdateEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active
  if (parsed.data.note !== undefined)      updateData.note = parsed.data.note

  const { error } = await supabase
    .schema('auth_hub')
    .from('allowed_emails')
    .update(updateData)
    .eq('email', parsed.data.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

// DELETE — twardo usuń wpis (rzadkie; zwykle wystarczy is_active=false)
export async function DELETE(req: NextRequest) {
  const guard = await ensureGlobalAdmin()
  if ('error' in guard) return guard.error
  const { supabase } = guard

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'Brak parametru email' }, { status: 422 })

  const { error } = await supabase
    .schema('auth_hub')
    .from('allowed_emails')
    .delete()
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
