import { z } from 'zod'

export const SimulationSchema = z.object({
  vehicle_id:      z.string().uuid('Wybierz pojazd'),
  startDate:       z.string().date('Podaj prawidlowa date poczatkowa'),
  endDate:         z.string().date('Podaj prawidlowa date koncowa'),
  currentOdometer: z.number({ invalid_type_error: 'Podaj aktualny stan licznika' }).int().positive(),
})
.refine(d => d.endDate > d.startDate, {
  message: 'Data koncowa musi byc pozniejsza niz poczatkowa',
  path: ['endDate'],
})

export type SimulationInput = z.infer<typeof SimulationSchema>
