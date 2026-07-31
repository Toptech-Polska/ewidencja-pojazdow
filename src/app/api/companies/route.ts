import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'administrator') {
    return { user: null, error: NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 }) }
  }

  return { user, error: null }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .schema('vat_km')
    .from('companies')
    .select('id, name, nip, krs, regon, address, created_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await req.json()
  const { name, nip, krs, regon, address } = body
  if (!name || !nip) return NextResponse.json({ error: 'Nazwa i NIP są wymagane' }, { status: 422 })

  // Admin klient omija RLS — autoryzacja sprawdzona wyżej przez requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('vat_km')
    .from('companies')
    .insert({ name, nip, krs: krs || null, regon: regon || null, address: address || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await req.json()
  const { id, name, nip, krs, regon, address } = body
  if (!id) return NextResponse.json({ error: 'Brak id firmy' }, { status: 422 })

  // Admin klient omija RLS — autoryzacja sprawdzona wyżej przez requireAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('vat_km')
    .from('companies')
    .update({ name, nip, krs: krs || null, regon: regon || null, address: address || null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
