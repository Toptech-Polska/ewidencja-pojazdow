import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .schema('vat_km').from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['administrator', 'ksiegowosc'].includes(profile.role))
    return NextResponse.json({ error: 'Brak uprawnień do potwierdzania wpisów' }, { status: 403 })

  const { data, error } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .update({
      confirmed_by_company: true,
      confirmed_by:         user.id,
      confirmed_at:         new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
