import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { interpretDbError } from '@/lib/errors/db-errors'
import { z } from 'zod'

const LoanSchema = z.object({
  vehicle_id: z.string().uuid({ message: 'Wybierz pojazd' }),
  loan_date: z.string().date({ message: 'Podaj prawidlowa date' }),
  purpose: z.string().min(5, 'Cel musi miec co najmniej 5 znakow').max(500),
  loaned_to_name: z.string().min(2, 'Podaj imie i nazwisko').max(200),
  loaned_to_user_id: z.string().uuid().optional().or(z.literal('')),
  odometer_at_issue: z.number({ invalid_type_error: 'Podaj stan licznika' }).int().nonnegative(),
  notes: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['administrator', 'ksiegowosc', 'kierowca'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnien do dodawania udostepnien' }, { status: 403 })

  const body = await req.json()
  const parsed = LoanSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 })

  const d = parsed.data
  const { data: nextNum, error: seqError } = await supabase
    .schema('vat_km').rpc('next_entry_number', { p_vehicle_id: d.vehicle_id })
  if (seqError) return NextResponse.json(interpretDbError(seqError.message), { status: 400 })

  const { data, error } = await supabase.schema('vat_km').from('vehicle_loans')
    .insert({
      vehicle_id: d.vehicle_id, entry_number: nextNum, loan_date: d.loan_date,
      purpose: d.purpose, loaned_to_name: d.loaned_to_name,
      loaned_to_user_id: d.loaned_to_user_id || null,
      odometer_at_issue: d.odometer_at_issue, notes: d.notes || null, created_by: user.id,
    }).select().single()
  if (error) return NextResponse.json(interpretDbError(error.message), { status: 400 })

  return NextResponse.json(data, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicle_id')

  let query = supabase.schema('vat_km').from('vehicle_loans')
    .select('*, vehicles(plate_number, make, model)').order('entry_number', { ascending: false })
  if (vehicleId) query = query.eq('vehicle_id', vehicleId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
