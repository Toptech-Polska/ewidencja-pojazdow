import { describe, it, expect } from 'vitest'
import { buildReturnEntry } from '../buildReturnEntry'

describe('buildReturnEntry', () => {
  const base = {
    vehicle_id: 'vehicle-uuid-1',
    trip_date: '2024-05-09',
    purpose: 'Spotkanie z klientem',
    route_from: 'Bydgoszcz, ul. Długa 10',
    route_to: 'Warszawa, Al. Jana Pawła II 22',
    odometer_before: 1000,
    odometer_after: 1100,
    driver_id: 'driver-uuid-1',
  }

  it('inverts route_from and route_to', () => {
    const ret = buildReturnEntry(base)
    expect(ret.route_from).toBe(base.route_to)
    expect(ret.route_to).toBe(base.route_from)
  })

  it('sets purpose to fixed return label', () => {
    const ret = buildReturnEntry(base)
    expect(ret.purpose).toBe('Powrót do siedziby firmy')
  })

  it('sets odometer_before to original odometer_after', () => {
    const ret = buildReturnEntry(base)
    expect(ret.odometer_before).toBe(1100)
  })

  it('sets odometer_after = odometer_before + same distance', () => {
    const ret = buildReturnEntry(base)
    expect(ret.odometer_after).toBe(1200) // 1100 + 100
  })

  it('preserves vehicle_id, trip_date, driver_id', () => {
    const ret = buildReturnEntry(base)
    expect(ret.vehicle_id).toBe(base.vehicle_id)
    expect(ret.trip_date).toBe(base.trip_date)
    expect(ret.driver_id).toBe(base.driver_id)
  })

  it('works with external driver (no driver_id)', () => {
    const ext = { ...base, driver_id: undefined, driver_name_external: 'Jan Kowalski' }
    const ret = buildReturnEntry(ext)
    expect(ret.driver_name_external).toBe('Jan Kowalski')
    expect(ret.driver_id).toBeUndefined()
  })

  it('handles 0 km distance correctly', () => {
    // edge case: odometer_after === odometer_before (shouldn't happen in practice)
    const zero = { ...base, odometer_after: 1000 }
    const ret = buildReturnEntry(zero)
    expect(ret.odometer_before).toBe(1000)
    expect(ret.odometer_after).toBe(1000)
  })
})
