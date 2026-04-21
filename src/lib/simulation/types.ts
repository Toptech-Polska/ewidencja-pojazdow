export type { SimulationLocationType, SimulationLocation, SimulationConfig } from '@/types/database'
import type { SimulationLocation } from '@/types/database'

export interface SimulationParams {
  vehicleId:     string
  startOdometer: number
  targetKm:      number  // currentOdometer - startOdometer
  startDate:     string  // YYYY-MM-DD
  endDate:       string  // YYYY-MM-DD
  locations:     SimulationLocation[]
}

export interface SimulatedTrip {
  vehicle_id:      string
  trip_date:       string  // YYYY-MM-DD
  purpose:         string
  route_from:      string  // location label
  route_to:        string  // location label
  odometer_before: number
  odometer_after:  number
}

// Internal — used in generate.ts, stripped before sending to client
export interface SimulatedTripDraft extends SimulatedTrip {
  _from_address: string  // full address for Maps API
  _to_address:   string  // full address for Maps API
}
