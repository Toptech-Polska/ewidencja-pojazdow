// Google Maps Distance Matrix API helper
// Wywolywane server-side — klucz nigdy nie trafia do przegladarki

export interface DistancePair {
  from: string  // pelny adres
  to: string    // pelny adres
}

export function distanceKey(from: string, to: string): string {
  return `${from}|||${to}`
}

/**
 * Batch call to Distance Matrix API for all unique address pairs.
 * Returns a map of "from|||to" -> km (rounded, min 1).
 */
export async function getDistances(pairs: DistancePair[]): Promise<Map<string, number>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY nie jest skonfigurowany')

  const uniqueOrigins      = [...new Set(pairs.map(p => p.from))]
  const uniqueDestinations = [...new Set(pairs.map(p => p.to))]

  const params = new URLSearchParams({
    origins:      uniqueOrigins.join('|'),
    destinations: uniqueDestinations.join('|'),
    mode:         'driving',
    language:     'pl',
    key:          apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`Maps API HTTP ${res.status}`)

  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Maps API status: ${data.status}`)

  const result = new Map<string, number>()

  data.rows.forEach((row: any, i: number) => {
    row.elements.forEach((el: any, j: number) => {
      if (el.status === 'OK') {
        result.set(
          distanceKey(uniqueOrigins[i], uniqueDestinations[j]),
          Math.max(1, Math.round(el.distance.value / 1000))
        )
      }
    })
  })

  return result
}
