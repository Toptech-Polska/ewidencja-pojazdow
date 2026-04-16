import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VehicleSchema } from '@/lib/validations/vehicle'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .select('*')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = VehicleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const d = parsed.data

  // Pobierz company_id z profilu zalogowanego użytkownika
  const { data: profile, error: profileError } = await supabase
    .schema('vat_km')
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Nie znaleziono profilu użytkownika. Upewnij się, że konto jest poprawnie skonfigurowane.' },
      { status: 403 },
    )
  }

  const { data, error } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .insert({
      company_id:                profile.company_id,
      plate_number:              d.plate_number.toUpperCase(),
      make:                      d.make,
      model:                     d.model,
      vin:                       d.vin || null,
      record_start_date:         d.record_start_date,
      odometer_start:            d.odometer_start,
      vat26_first_expense_date:  d.vat26_first_expense_date || d.record_start_date,
      created_by:                user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Inicjalizuj sekwencję numerów wpisów dla pojazdu
  await supabase
    .schema('vat_km')
    .from('entry_sequences')
    .insert({ vehicle_id: data.id, last_number: 0 })

  return NextResponse.json(data, { status: 201 })
}
