import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Pola edytowalne przez kierowcę (własne wpisy) oraz admina/księgowość.
// Pola licznikowe (odometer_before, odometer_after, vehicle_id) są celowo
// wykluczone — ich zmiana naruszałaby integralność ewidencji.
const EditSchema = z.object({
  trip_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format daty: YYYY-MM-DD').optional(),
  purpose:     z.string().min(3, 'Cel wyjazdu musi mieć co najmniej 3 znaki').max(500).optional(),
  route_from:  z.string().min(2).max(300).optional(),
  route_to:    z.string().min(2).max(300).optional(),
  notes:       z.string().max(1000).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Brak pól do zaktualizowania',
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = EditSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  // Sprawdź czy wpis istnieje i czy user ma do niego dostęp (tr_select to gwarantuje)
  const { data: existing, error: fetchError } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .select('id, created_by, confirmed_by_company, requires_confirmation')
    .eq('id', params.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Wpis nie istnieje lub brak dostępu' }, { status: 404 })
  }

  // Nie pozwalamy edytować wpisów zatwierdzonych przez spółkę —
  // po zatwierdzeniu wpis jest "zamknięty" dla celów art. 86a.
  if (existing.confirmed_by_company) {
    return NextResponse.json(
      { error: 'Nie można edytować zatwierdzonego wpisu. Skontaktuj się z administratorem.' },
      { status: 403 },
    )
  }

  // UPDATE — RLS (tr_update) dodatkowo weryfikuje uprawnienia po stronie bazy:
  // - administrator/księgowość: każdy wpis firmy
  // - kierowca: tylko własne (created_by = auth.uid())
  const { data, error: updateError } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .update(parsed.data)
    .eq('id', params.id)
    .select('id, trip_date, purpose, route_from, route_to, notes, updated_at')
    .single()

  if (updateError) {
    // Błąd RLS (42501) = kierowca próbuje edytować cudzy wpis
    if ((updateError as any).code === '42501') {
      return NextResponse.json(
        { error: 'Możesz edytować tylko własne wpisy' },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
