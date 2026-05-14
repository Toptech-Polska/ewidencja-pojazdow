import type { SimulationParams, SimulatedTripDraft } from './types'
import type { SimulationLocation } from '@/types/database'
import { distanceKey } from './maps'

// Fallback purposes used when a location has no configured purposes
const FALLBACK_PURPOSES = [
  'Spotkanie z klientem', 'Wizyta serwisowa', 'Odbior dokumentow',
  'Szkolenie zewnetrzne', 'Kontrola budowy', 'Spotkanie handlowe',
  'Dostawa materialow', 'Wizyta u dostawcy', 'Konferencja branzowa',
  'Przekazanie sprzetu',
]

const CORRECTION_PURPOSE    = 'Zaopatrzenie biurowe'
const CORRECTION_FROM_LABEL   = 'Nowa Sol'
const CORRECTION_FROM_ADDRESS = 'ul. Parafialna 2, 67-100 Nowa Sol'
const MIN_CORRECTION_KM = 2

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
 * Pick a purpose for a trip going TO the given location.
 * Uses the location's configured purposes if available, otherwise falls back to global list.
 */
function pickPurpose(to: SimulationLocation, rand: () => number): string {
  const pool = to.purposes && to.purposes.length > 0 ? to.purposes : FALLBACK_PURPOSES
  return pool[Math.floor(rand() * pool.length)]
}

interface RawTrip {
  fromLabel:   string
  fromAddress: string
  toLabel:     string
  toAddress:   string
  km:          number
  purpose?:    string   // if set, overrides pickPurpose()
  toLoc?:      SimulationLocation  // reference for purpose picking
}

/**
 * Generates trips that:
 *  - Start at siedziba firmy (first trip from siedziba)
 *  - End at siedziba firmy (via correction trip)
 *  - Sum to exactly targetKm
 *  - Use per-location purposes when configured
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

  // Ensure all locations have purposes array (backward compat)
  const locs = locations.map(l => ({ purposes: [], ...l }))

  // ── Find siedziba ────────────────────────────────────────────────────────────
  const siedziba: SimulationLocation =
    locs.find(l => l.type === 'siedziba') ?? locs[0]
  const others: SimulationLocation[] =
    locs.filter(l => l.id !== siedziba.id)

  if (others.length === 0) return []

  // ── Build all valid pairs with known distances ───────────────────────────────
  interface Pair { from: SimulationLocation; to: SimulationLocation; km: number }
  const allPairs: Pair[] = []
  for (const from of locs) {
    for (const to of locs) {
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
      toLoc:       firstTo,
      km:          firstKm,
    })
    accumulated = firstKm
  }

  // ── Phase 2: Middle trips — random pairs within budget ──────────────────────
  let iters = 0
  while (iters < 2000) {
    const remaining = targetKm - MIN_CORRECTION_KM - accumulated
    if (remaining <= 0) break
    const available = allPairs.filter(p => p.km <= remaining)
    if (available.length === 0) break
    const pair = available[Math.floor(rand() * available.length)]
    rawTrips.push({
      fromLabel:   pair.from.label,
      fromAddress: pair.from.address,
      toLabel:     pair.to.label,
      toAddress:   pair.to.address,
      toLoc:       pair.to,
      km:          pair.km,
    })
    accumulated += pair.km
    iters++
  }

  // ── Phase 3: Correction trip — Nowa Sol → siedziba, exact remaining km ──────
  const correctionKm = targetKm - accumulated
  if (correctionKm > 0) {
    rawTrips.push({
      fromLabel:   CORRECTION_FROM_LABEL,
      fromAddress: CORRECTION_FROM_ADDRESS,
      toLabel:     siedziba.label,
      toAddress:   siedziba.address,
      toLoc:       siedziba,
      km:          correctionKm,
      purpose:     CORRECTION_PURPOSE,
    })
  }

  if (rawTrips.length === 0) return []

  // ── Distribute dates evenly ──────────────────────────────────────────────────
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
    // Use explicit purpose (correction trip) or pick from destination's purposes list
    const purpose = trip.purpose ?? (trip.toLoc ? pickPurpose(trip.toLoc, rand) : FALLBACK_PURPOSES[0])
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
