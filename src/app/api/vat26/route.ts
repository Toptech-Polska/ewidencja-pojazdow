import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Vat26FiledSchema } from '@/lib/validations/vehicle'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = Vat26FiledSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { data, error } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .update({
      vat26_filed:      true,
      vat26_filed_date: parsed.data.vat26_filed_date,
      vat26_notes:      parsed.data.vat26_notes || null,
    })
    .eq('id', parsed.data.vehicle_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
