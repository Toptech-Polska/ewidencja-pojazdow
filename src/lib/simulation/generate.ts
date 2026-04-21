import type { SimulationParams, SimulatedTripDraft } from './types'

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

export function generateTrips(params: SimulationParams): SimulatedTripDraft[] {
  const { vehicleId, startOdometer, startDate, endDate, tripsPerWeek, locations } = params
  if (locations.length < 2) return []

  const totalDays = daysBetween(startDate, endDate)
  if (totalDays <= 0) return []

  const totalTrips = Math.round((totalDays / 7) * tripsPerWeek)
  if (totalTrips === 0) return []

  const rand = seededRand(vehicleId.charCodeAt(0) * 31 + startOdometer)

  // Distribute dates evenly with slight jitter
  const interval = totalDays / totalTrips
  const dates: string[] = []
  for (let i = 0; i < totalTrips; i++) {
    const base = interval * i + interval * 0.5
    const jitter = (rand() - 0.5) * 2
    const day = Math.max(0, Math.min(totalDays - 1, Math.round(base + jitter)))
    dates.push(addDays(startDate, day))
  }
  dates.sort()

  const trips: SimulatedTripDraft[] = []

  for (let i = 0; i < totalTrips; i++) {
    const fromIdx = Math.floor(rand() * locations.length)
    let toIdx = Math.floor(rand() * locations.length)
    if (toIdx === fromIdx) toIdx = (fromIdx + 1) % locations.length

    const from = locations[fromIdx]
    const to   = locations[toIdx]
    const purpose = PURPOSES[Math.floor(rand() * PURPOSES.length)]

    trips.push({
      vehicle_id:       vehicleId,
      trip_date:        dates[i],
      purpose,
      route_from:       from.label,
      route_to:         to.label,
      odometer_before:  startOdometer, // placeholder — recalculated after Maps
      odometer_after:   startOdometer, // placeholder — filled by Maps distances
      _from_address:    from.address,
      _to_address:      to.address,
    })
  }

  return trips
}
