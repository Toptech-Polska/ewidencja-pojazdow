import { z } from 'zod'

export const SimulationSchema = z.object({
  vehicle_id:    z.string().uuid('Wybierz pojazd'),
  startDate:     z.string().date('Podaj prawidłową datę początkową'),
  endDate:       z.string().date('Podaj prawidłową datę końcową'),
  tripsPerWeek:  z.number({ invalid_type_error: 'Podaj liczbę wpisów tygodniowo' }).int().min(1).max(14),
  avgKmPerTrip:  z.number({ invalid_type_error: 'Podaj średni dystans' }).int().min(5).max(500),
})
.refine(d => d.endDate > d.startDate, {
  message: 'Data końcowa musi być późniejsza niż początkowa',
  path: ['endDate'],
})

export type SimulationInput = z.infer<typeof SimulationSchema>
