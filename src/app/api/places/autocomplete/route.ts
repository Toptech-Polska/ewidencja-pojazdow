import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const input = req.nextUrl.searchParams.get('input') ?? ''
  if (input.length < 3) return NextResponse.json({ predictions: [] })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Maps API not configured' }, { status: 500 })

  const params = new URLSearchParams({
    input,
    language:   'pl',
    components: 'country:pl',
    types:      'geocode',
    key:        apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return NextResponse.json({ error: `Maps HTTP ${res.status}` }, { status: 500 })

  const data = await res.json()
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ error: data.status }, { status: 400 })
  }

  const predictions = (data.predictions ?? []).map((p: any) => ({
    place_id:       p.place_id,
    description:    p.description,
    main_text:      p.structured_formatting?.main_text      ?? p.description,
    secondary_text: p.structured_formatting?.secondary_text ?? '',
  }))

  return NextResponse.json({ predictions })
}
