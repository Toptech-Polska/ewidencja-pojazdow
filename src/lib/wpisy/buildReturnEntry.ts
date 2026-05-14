export interface TripEntryInput {
  vehicle_id: string
  trip_date: string
  purpose: string
  route_from: string
  route_to: string
  odometer_before: number
  odometer_after: number
  driver_id?: string
  driver_name_external?: string
}

export function buildReturnEntry(original: TripEntryInput): TripEntryInput {
  const distance = original.odometer_after - original.odometer_before
  return {
    vehicle_id: original.vehicle_id,
    trip_date: original.trip_date,
    purpose: 'Powrót do siedziby firmy',
    route_from: original.route_to,
    route_to: original.route_from,
    odometer_before: original.odometer_after,
    odometer_after: original.odometer_after + distance,
    driver_id: original.driver_id,
    driver_name_external: original.driver_name_external,
  }
}
