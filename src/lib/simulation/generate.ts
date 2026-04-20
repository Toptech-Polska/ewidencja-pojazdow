import type { SimulationParams, SimulatedTrip } from './types'

const PURPOSES = [
  'Spotkanie z klientem',
  'Wizyta serwisowa',
  'Odbiór dokumentów',
  'Szkolenie zewnętrzne',
  'Kontrola budowy',
  'Spotkanie handlowe',
  'Dostawa materiałów',
  'Wizyta u dostawcy',
  'Konferencja branżowa',
  'Przekazanie sprzętu',
]

const CITIES = [
  'Warszawa', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań',
  'Łódź', 'Katowice', 'Bydgoszcz', 'Lublin', 'Szczecin',
  'Rzeszów', 'Toruń', 'Białystok', 'Gdynia', 'Częstochowa',
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

export function generateTrips(params: SimulationParams): SimulatedTrip[] {
  const { vehicleId, startOdometer, startDate, endDate, tripsPerWeek, avgKmPerTrip } = params
  const totalDays = daysBetween(startDate, endDate)
  if (totalDays <= 0) return []

  const totalTrips = Math.round((totalDays / 7) * tripsPerWeek)
  if (totalTrips === 0) return []

  const rand = seededRand(vehicleId.charCodeAt(0) * 31 + startOdometer)

  // Rozkładamy daty równomiernie w przedziale, z losowym szumem ±1 dzień
  const interval = totalDays / totalTrips
  const dates: string[] = []
  for (let i = 0; i < totalTrips; i++) {
    const base = interval * i + interval * 0.5
    const jitter = (rand() - 0.5) * 2  // -1..+1 dni
    const day = Math.max(0, Math.min(totalDays - 1, Math.round(base + jitter)))
    dates.push(addDays(startDate, day))
  }
  dates.sort()

  let odometer = startOdometer
  const trips: SimulatedTrip[] = []

  for (let i = 0; i < totalTrips; i++) {
    const variance = 0.4  // ±40% od średniej
    const km = Math.max(5, Math.round(avgKmPerTrip * (1 + (rand() - 0.5) * 2 * variance)))
    const cityFrom = CITIES[Math.floor(rand() * CITIES.length)]
    let cityTo = CITIES[Math.floor(rand() * CITIES.length)]
    if (cityTo === cityFrom) cityTo = CITIES[(CITIES.indexOf(cityFrom) + 1) % CITIES.length]
    const purpose = PURPOSES[Math.floor(rand() * PURPOSES.length)]

    trips.push({
      vehicle_id:      vehicleId,
      trip_date:       dates[i],
      purpose,
      route_from:      cityFrom,
      route_to:        cityTo,
      odometer_before: odometer,
      odometer_after:  odometer + km,
    })
    odometer += km
  }

  return trips
}
