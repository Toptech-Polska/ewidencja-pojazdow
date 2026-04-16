import { z } from 'zod'

export const TripEntrySchema = z.object({
  vehicle_id: z.string().uuid({ message: 'Wybierz pojazd' }),
  trip_date: z.string().date({ message: 'Podaj prawidłową datę' }),

  purpose: z
    .string()
    .min(5, 'Cel wyjazdu musi mieć co najmniej 5 znaków')
    .max(500, 'Cel wyjazdu nie może przekraczać 500 znaków'),

  route_from: z
    .string()
    .min(2, 'Podaj miejsce wyjazdu')
    .max(200),

  route_to: z
    .string()
    .min(2, 'Podaj miejsce docelowe')
    .max(200),

  odometer_before: z
    .number({ invalid_type_error: 'Podaj stan licznika' })
    .int('Licznik musi być liczbą całkowitą')
    .nonnegative('Licznik nie może być ujemny'),

  odometer_after: z
    .number({ invalid_type_error: 'Podaj stan licznika' })
    .int('Licznik musi być liczbą całkowitą')
    .positive('Licznik musi być liczbą dodatnią'),

  driver_id: z.string().uuid().optional().or(z.literal('')),
  driver_name_external: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
})
.refine(
  (d) => d.odometer_after > d.odometer_before,
  {
    message: 'Licznik po powrocie musi być większy niż przed wyjazdem',
    path: ['odometer_after'],
  },
)
.refine(
  (d) => d.driver_id || d.driver_name_external,
  {
    message: 'Wymagany kierowca — wybierz z listy lub wpisz imię i nazwisko',
    path: ['driver_id'],
  },
)

export type TripEntryInput = z.infer<typeof TripEntrySchema>

// Schema do zatwierdzania wpisów
export const ConfirmTripSchema = z.object({
  trip_id: z.string().uuid(),
})

// Schema do stanu licznika na koniec okresu
export const OdometerSnapshotSchema = z.object({
  vehicle_id: z.string().uuid(),
  period_year_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  odometer_reading: z
    .number()
    .int()
    .nonnegative('Licznik nie może być ujemny'),
})
