import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password, fullName, companyName, nip } = await req.json()

  if (!email || !password || !fullName || !companyName || !nip) {
    return NextResponse.json({ error: 'Wszystkie pola są wymagane' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Sprawdź czy już są jakieś profile (setup jednorazowy)
  const { count } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Setup już został wykonany' }, { status: 403 })
  }

  const { data: company, error: compErr } = await supabase
    .schema('vat_km')
    .from('companies')
    .insert({ name: companyName, nip })
    .select()
    .single()

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 400 })

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  const { error: profileErr } = await supabase
    .schema('vat_km')
    .from('profiles')
    .insert({
      id:         authUser.user.id,
      company_id: company.id,
      full_name:  fullName,
      email,
      role:       'administrator',
    })

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
