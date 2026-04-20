export interface SimulationParams {
  vehicleId: string
  startOdometer: number
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  tripsPerWeek: number  // 1–14
  avgKmPerTrip: number  // średni dystans jednego wyjazdu
}

export interface SimulatedTrip {
  vehicle_id: string
  trip_date: string     // YYYY-MM-DD
  purpose: string
  route_from: string
  route_to: string
  odometer_before: number
  odometer_after: number
}
