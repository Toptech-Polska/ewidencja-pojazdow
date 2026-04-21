import { z } from 'zod'

export const SimulationSchema = z.object({
  vehicle_id:   z.string().uuid('Wybierz pojazd'),
  startDate:    z.string().date('Podaj prawidlowa date poczatkowa'),
  endDate:      z.string().date('Podaj prawidlowa date koncowa'),
  tripsPerWeek: z.number({ invalid_type_error: 'Podaj liczbe wpisow tygodniowo' }).int().min(1).max(14),
  // avgKmPerTrip removed — distances now come from Google Maps Distance Matrix
})
.refine(d => d.endDate > d.startDate, {
  message: 'Data koncowa musi byc pozniejsza niz poczatkowa',
  path: ['endDate'],
})

export type SimulationInput = z.infer<typeof SimulationSchema>
