import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email:     z.string().email('Podaj prawidlowy email'),
  full_name: z.string().min(2, 'Imie i nazwisko musi miec co najmniej 2 znaki').max(200),
  role:      z.enum(['administrator', 'ksiegowosc', 'kierowca', 'kontrola']),
  password:  z.string().min(8, 'Haslo musi miec co najmniej 8 znakow'),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'administrator')
    return NextResponse.json({ error: 'Brak uprawnien administratora' }, { status: 403 })

  const body = await req.json()
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const { email, full_name, role, password } = parsed.data

  const adminSupabase = await createAdminClient()

  const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  const { error: profileErr } = await adminSupabase
    .schema('vat_km').from('profiles')
    .insert({ id: authUser.user.id, company_id: profile.company_id, full_name, email, role })

  if (profileErr) {
    await adminSupabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, id: authUser.user.id }, { status: 201 })
}
