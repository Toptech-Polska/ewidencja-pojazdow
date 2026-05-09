import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const LocationSchema = z.object({
  id:      z.string(),
  label:   z.string().min(1).max(200),
  address: z.string().min(5).max(500),
  type:    z.enum(['siedziba', 'dom', 'klient', 'inne']),
})

// Admin: może edytować imię/nazwisko, rolę, status aktywności i — kluczowe —
// flagę role_assigned. Pierwsze nadanie roli oznacza ustawienie role_assigned=true.
const AdminUpdateSchema = z.object({
  full_name:         z.string().min(2).max(200).optional(),
  role:              z.enum(['administrator', 'ksiegowosc', 'kierowca', 'kontrola']).optional(),
  is_active:         z.boolean().optional(),
  role_assigned:     z.boolean().optional(),
  simulation_config: z.object({ locations: z.array(LocationSchema) }).optional(),
})

const SelfUpdateSchema = z.object({
  full_name:         z.string().min(2, 'Imie i nazwisko musi miec co najmniej 2 znaki').max(200).optional(),
  simulation_config: z.object({ locations: z.array(LocationSchema) }).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles')
    .select('role, company_id, role_assigned').eq('id', user.id).single()

  // Admin = ma profil + role='administrator' + role_assigned=true.
  // Profil bez role_assigned NIE jest adminem nawet jeśli role='administrator'.
  const isAdmin = !!profile && profile.role === 'administrator' && profile.role_assigned === true

  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (isAdmin) {
    const { data: target } = await supabase
      .schema('vat_km').from('profiles')
      .select('id, role_assigned').eq('id', params.id).eq('company_id', profile.company_id).single()
    if (!target) return NextResponse.json({ error: 'Profil nie istnieje lub brak dostepu' }, { status: 404 })

    const parsed = AdminUpdateSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

    // Auto-ustaw role_assigned=true gdy admin po raz pierwszy wybiera rolę
    // dla profilu z role_assigned=false — chyba że klient jawnie podał inaczej.
    const updatePayload: Record<string, unknown> = { ...parsed.data }
    if (
      parsed.data.role !== undefined &&
      parsed.data.role_assigned === undefined &&
      target.role_assigned === false
    ) {
      updatePayload.role_assigned = true
    }

    const { data, error } = await supabase
      .schema('vat_km').from('profiles')
      .update(updatePayload).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  // Non-admin: edytuje tylko własny profil
  if (params.id !== user.id)
    return NextResponse.json({ error: 'Mozesz edytowac tylko wlasny profil' }, { status: 403 })

  const parsed = SelfUpdateSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const updateData: Record<string, any> = {}
  if (parsed.data.full_name !== undefined)         updateData.full_name = parsed.data.full_name
  if (parsed.data.simulation_config !== undefined) updateData.simulation_config = parsed.data.simulation_config

  const { data, error } = await supabase
    .schema('vat_km').from('profiles')
    .update(updateData).eq('id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
