import type { SimulationParams, SimulatedTripDraft } from './types'
import { distanceKey } from './maps'

const PURPOSES = [
  'Spotkanie z klientem', 'Wizyta serwisowa', 'Odbior dokumentow',
  'Szkolenie zewnetrzne', 'Kontrola budowy', 'Spotkanie handlowe',
  'Dostawa materialow', 'Wizyta u dostawcy', 'Konferencja branzowa',
  'Przekazanie sprzetu',
]

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

/**
 * Generates trips that sum to exactly targetKm.
 * distances: preloaded Map from Maps API (distanceKey -> km)
 */
export function generateTrips(
  params: SimulationParams,
  distances: Map<string, number>,
): SimulatedTripDraft[] {
  const { vehicleId, startOdometer, targetKm, startDate, endDate, locations } = params
  if (locations.length < 2 || targetKm <= 0) return []

  const totalDays = daysBetween(startDate, endDate)
  if (totalDays <= 0) return []

  const rand = seededRand(vehicleId.charCodeAt(0) * 31 + startOdometer)

  // Build list of valid pairs (those with a known distance)
  const validPairs: Array<{ fromIdx: number; toIdx: number; km: number }> = []
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue
      const km = distances.get(distanceKey(locations[i].address, locations[j].address))
      if (km && km > 0) validPairs.push({ fromIdx: i, toIdx: j, km })
    }
  }
  if (validPairs.length === 0) return []

  // Accumulate trips until we reach targetKm
  const rawTrips: Array<{ fromIdx: number; toIdx: number; km: number }> = []
  let accumulated = 0

  // Safety limit: never more than 500 trips
  while (accumulated < targetKm && rawTrips.length < 500) {
    const pairIdx = Math.floor(rand() * validPairs.length)
    const pair = validPairs[pairIdx]
    const remaining = targetKm - accumulated

    if (rawTrips.length > 0 && remaining < pair.km) {
      // Close enough — last trip fills the exact remainder
      rawTrips.push({ ...pair, km: remaining })
      accumulated += remaining
    } else {
      rawTrips.push(pair)
      accumulated += pair.km
    }
  }

  // Distribute dates evenly across the range
  const totalTrips = rawTrips.length
  const interval = totalDays / totalTrips
  const dates: string[] = []
  for (let i = 0; i < totalTrips; i++) {
    const base = interval * i + interval * 0.5
    const jitter = (rand() - 0.5) * 2
    const day = Math.max(0, Math.min(totalDays - 1, Math.round(base + jitter)))
    dates.push(addDays(startDate, day))
  }
  dates.sort()

  // Build final trips with odometers
  let odo = startOdometer
  const trips: SimulatedTripDraft[] = rawTrips.map((pair, i) => {
    const from    = locations[pair.fromIdx]
    const to      = locations[pair.toIdx]
    const purpose = PURPOSES[Math.floor(rand() * PURPOSES.length)]
    const trip: SimulatedTripDraft = {
      vehicle_id:      vehicleId,
      trip_date:       dates[i],
      purpose,
      route_from:      from.label,
      route_to:        to.label,
      odometer_before: odo,
      odometer_after:  odo + pair.km,
      _from_address:   from.address,
      _to_address:     to.address,
    }
    odo += pair.km
    return trip
  })

  return trips
}
