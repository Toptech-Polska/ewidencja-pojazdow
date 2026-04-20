import { describe, it, expect } from 'vitest'
import { generateTrips } from './generate'
import type { SimulationParams } from './types'

const BASE: SimulationParams = {
  vehicleId: 'test-vehicle-1',
  startOdometer: 50000,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  tripsPerWeek: 5,
  avgKmPerTrip: 80,
}

describe('generateTrips', () => {
  it('zwraca puste array gdy endDate <= startDate', () => {
    expect(generateTrips({ ...BASE, endDate: '2023-12-31' })).toHaveLength(0)
    expect(generateTrips({ ...BASE, endDate: BASE.startDate })).toHaveLength(0)
  })

  it('każdy odometer_after > odometer_before', () => {
    const trips = generateTrips(BASE)
    for (const t of trips) {
      expect(t.odometer_after).toBeGreaterThan(t.odometer_before)
    }
  })

  it('ciągłość licznika — odometer_before każdego wpisu = odometer_after poprzedniego', () => {
    const trips = generateTrips(BASE)
    expect(trips[0].odometer_before).toBe(BASE.startOdometer)
    for (let i = 1; i < trips.length; i++) {
      expect(trips[i].odometer_before).toBe(trips[i - 1].odometer_after)
    }
  })

  it('daty wpisów mieszczą się w podanym przedziale', () => {
    const trips = generateTrips(BASE)
    for (const t of trips) {
      expect(t.trip_date >= BASE.startDate).toBe(true)
      expect(t.trip_date < BASE.endDate).toBe(true)
    }
  })

  it('daty wpisów są posortowane rosnąco', () => {
    const trips = generateTrips(BASE)
    for (let i = 1; i < trips.length; i++) {
      expect(trips[i].trip_date >= trips[i - 1].trip_date).toBe(true)
    }
  })

  it('liczba wpisów jest zbliżona do oczekiwanej (±50%)', () => {
    const trips = generateTrips(BASE)
    const days = 30
    const expected = Math.round((days / 7) * BASE.tripsPerWeek)
    expect(trips.length).toBeGreaterThanOrEqual(Math.floor(expected * 0.5))
    expect(trips.length).toBeLessThanOrEqual(Math.ceil(expected * 1.5))
  })

  it('każdy wpis ma poprawne vehicle_id', () => {
    const trips = generateTrips(BASE)
    for (const t of trips) {
      expect(t.vehicle_id).toBe(BASE.vehicleId)
    }
  })

  it('tripsPerWeek=0 zwraca puste array', () => {
    expect(generateTrips({ ...BASE, tripsPerWeek: 0 })).toHaveLength(0)
  })
})
