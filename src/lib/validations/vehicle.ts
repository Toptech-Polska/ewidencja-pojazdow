import { z } from 'zod'

export const VehicleSchema = z.object({
  plate_number: z
    .string()
    .min(4, 'Podaj numer rejestracyjny')
    .max(10, 'Numer rejestracyjny jest za długi')
    .regex(/^[A-Z0-9 ]+$/i, 'Tylko litery i cyfry'),

  make: z.string().min(2, 'Podaj markę pojazdu').max(50),
  model: z.string().min(1, 'Podaj model pojazdu').max(100),
  vin: z.string().length(17, 'VIN musi mieć 17 znaków').optional().or(z.literal('')),

  record_start_date: z.string().date('Podaj prawidłową datę'),

  odometer_start: z
    .number({ invalid_type_error: 'Podaj stan licznika' })
    .int()
    .nonnegative('Licznik nie może być ujemny'),

  vat26_first_expense_date: z.string().date().optional().or(z.literal('')),
})

export type VehicleInput = z.infer<typeof VehicleSchema>

export const CloseVehicleSchema = z.object({
  vehicle_id: z.string().uuid(),
  record_end_date: z.string().date('Podaj datę zakończenia'),
  odometer_end: z
    .number({ invalid_type_error: 'Podaj końcowy stan licznika' })
    .int()
    .nonnegative(),
  status: z.enum(['zakonczony', 'zmieniony_sposob']).default('zakonczony'),
})

export type CloseVehicleInput = z.infer<typeof CloseVehicleSchema>

export const Vat26FiledSchema = z.object({
  vehicle_id: z.string().uuid(),
  vat26_filed_date: z.string().date('Podaj datę złożenia VAT-26'),
  vat26_notes: z.string().max(500).optional(),
})

export type Vat26FiledInput = z.infer<typeof Vat26FiledSchema>
