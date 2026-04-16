import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CloseVehicleSchema } from '@/lib/validations/vehicle'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CloseVehicleSchema.safeParse({ vehicle_id: params.id, ...body })

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
      status:          parsed.data.status,
      record_end_date: parsed.data.record_end_date,
      odometer_end:    parsed.data.odometer_end,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
