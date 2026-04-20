import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const AdminUpdateSchema = z.object({
  full_name: z.string().min(2).max(200).optional(),
  role:      z.enum(['administrator', 'ksiegowosc', 'kierowca', 'kontrola']).optional(),
  is_active: z.boolean().optional(),
})

const SelfUpdateSchema = z.object({
  full_name: z.string().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(200),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id').eq('id', user.id).single()

  if (!profile)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (profile.role === 'administrator') {
    // Administrator może edytować każdy profil w swojej firmie
    const { data: target } = await supabase
      .schema('vat_km').from('profiles')
      .select('id').eq('id', params.id).eq('company_id', profile.company_id).single()

    if (!target)
      return NextResponse.json({ error: 'Profil nie istnieje lub brak dostępu' }, { status: 404 })

    const parsed = AdminUpdateSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 422 },
      )

    const { data, error } = await supabase
      .schema('vat_km').from('profiles')
      .update(parsed.data).eq('id', params.id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  // Kierowca (i inne role) — tylko własny profil, tylko full_name
  if (params.id !== user.id)
    return NextResponse.json({ error: 'Możesz edytować tylko własny profil' }, { status: 403 })

  const parsed = SelfUpdateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    )

  const { data, error } = await supabase
    .schema('vat_km').from('profiles')
    .update({ full_name: parsed.data.full_name }).eq('id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
