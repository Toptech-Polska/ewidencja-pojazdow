import { createClient } from '@/lib/supabase/client'

export interface LastOdometerResult {
  odometer: number
  lastDate: string | null
}

export async function getLastOdometer(
  vehicleId: string,
  odometerStart: number,
): Promise<LastOdometerResult> {
  const supabase = createClient()
  const { data } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .select('odometer_after, trip_date')
    .eq('vehicle_id', vehicleId)
    .order('entry_number', { ascending: false })
    .limit(1)
    .single()

  return {
    odometer: data?.odometer_after ?? odometerStart,
    lastDate: data?.trip_date ?? null,
  }
}
