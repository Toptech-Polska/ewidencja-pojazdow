import type { SimulationParams, SimulatedTripDraft } from './types'
import type { SimulationLocation } from '@/types/database'
import { distanceKey } from './maps'

const PURPOSES = [
  'Spotkanie z klientem', 'Wizyta serwisowa', 'Odbior dokumentow',
  'Szkolenie zewnetrzne', 'Kontrola budowy', 'Spotkanie handlowe',
  'Dostawa materialow', 'Wizyta u dostawcy', 'Konferencja branzowa',
  'Przekazanie sprzetu',
]

const CORRECTION_PURPOSE   = 'Zaopatrzenie biurowe'
const CORRECTION_FROM_LABEL   = 'Nowa Sol'
const CORRECTION_FROM_ADDRESS = 'ul. Parafialna 2, 67-100 Nowa Sol'
// Correction trip always ends at siedziba — route_to is set dynamically below
const MIN_CORRECTION_KM = 2  // minimum km reserved for the final correction trip

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

interface RawTrip {
  fromLabel:   string
  fromAddress: string
  toLabel:     string
  toAddress:   string
  km:          number
  purpose?:    string
}

/**
 * Generates trips that:
 *  - Start at siedziba firmy
 *  - End at siedziba firmy (via correction trip if needed)
 *  - Sum to exactly targetKm
 *
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

  // ── Find siedziba (type === 'siedziba', fallback to first location) ──────────
  const siedziba: SimulationLocation =
    locations.find(l => l.type === 'siedziba') ?? locations[0]
  const others: SimulationLocation[] =
    locations.filter(l => l.id !== siedziba.id)

  if (others.length === 0) return []

  // ── Build all valid pairs with known distances ───────────────────────────────
  interface Pair { from: SimulationLocation; to: SimulationLocation; km: number }
  const allPairs: Pair[] = []
  for (const from of locations) {
    for (const to of locations) {
      if (from.id === to.id) continue
      const km = distances.get(distanceKey(from.address, to.address))
      if (km && km > 0) allPairs.push({ from, to, km })
    }
  }
  if (allPairs.length === 0) return []

  const rawTrips: RawTrip[] = []
  let accumulated = 0

  // ── Phase 1: First trip — siedziba → random other ───────────────────────────
  const firstTo = others[Math.floor(rand() * others.length)]
  const firstKm = distances.get(distanceKey(siedziba.address, firstTo.address)) ?? 20

  if (firstKm < targetKm - MIN_CORRECTION_KM) {
    rawTrips.push({
      fromLabel:   siedziba.label,
      fromAddress: siedziba.address,
      toLabel:     firstTo.label,
      toAddress:   firstTo.address,
      km:          firstKm,
    })
    accumulated = firstKm
  }
  // (if firstKm alone already fills the gap, skip to correction trip below)

  // ── Phase 2: Middle trips — random pairs that fit within remaining budget ────
  let iters = 0
  while (iters < 2000) {
    const remaining = targetKm - MIN_CORRECTION_KM - accumulated
    if (remaining <= 0) break

    // Only consider pairs that fit within the remaining budget
    const available = allPairs.filter(p => p.km <= remaining)
    if (available.length === 0) break

    const pair = available[Math.floor(rand() * available.length)]
    rawTrips.push({
      fromLabel:   pair.from.label,
      fromAddress: pair.from.address,
      toLabel:     pair.to.label,
      toAddress:   pair.to.address,
      km:          pair.km,
    })
    accumulated += pair.km
    iters++
  }

  // ── Phase 3: Correction / return trip — Nowa Sol → siedziba ─────────────────
  // Always added as the last trip to ensure simulation ends at siedziba
  const correctionKm = targetKm - accumulated
  if (correctionKm > 0) {
    rawTrips.push({
      fromLabel:   CORRECTION_FROM_LABEL,
      fromAddress: CORRECTION_FROM_ADDRESS,
      toLabel:     siedziba.label,
      toAddress:   siedziba.address,
      km:          correctionKm,
      purpose:     CORRECTION_PURPOSE,
    })
  }

  if (rawTrips.length === 0) return []

  // ── Distribute dates evenly across the range ─────────────────────────────────
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

  // ── Build final SimulatedTripDraft[] ────────────────────────────────────────
  let odo = startOdometer
  return rawTrips.map((trip, i): SimulatedTripDraft => {
    const purpose = trip.purpose ?? PURPOSES[Math.floor(rand() * PURPOSES.length)]
    const draft: SimulatedTripDraft = {
      vehicle_id:      vehicleId,
      trip_date:       dates[i],
      purpose,
      route_from:      trip.fromLabel,
      route_to:        trip.toLabel,
      odometer_before: odo,
      odometer_after:  odo + trip.km,
      _from_address:   trip.fromAddress,
      _to_address:     trip.toAddress,
    }
    odo += trip.km
    return draft
  })
}
