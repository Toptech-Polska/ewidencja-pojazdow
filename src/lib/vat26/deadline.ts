import { Vehicle } from '@/types/database'

/**
 * Oblicza termin złożenia VAT-26.
 * Art. 86a ust. 14 ustawy o VAT: do 25. dnia miesiąca
 * następującego po miesiącu, w którym poniesiono pierwszy wydatek.
 */
export function getVat26Deadline(firstExpenseDate: Date): Date {
  const deadline = new Date(firstExpenseDate)
  deadline.setMonth(deadline.getMonth() + 1)
  deadline.setDate(25)
  return deadline
}

export function isVat26Overdue(vehicle: Vehicle): boolean {
  if (vehicle.vat26_filed) return false
  if (!vehicle.vat26_first_expense_date) return false
  const deadline = getVat26Deadline(new Date(vehicle.vat26_first_expense_date))
  return new Date() > deadline
}

export function daysUntilVat26(vehicle: Vehicle): number | null {
  if (!vehicle.vat26_first_expense_date || vehicle.vat26_filed) return null
  const deadline = getVat26Deadline(new Date(vehicle.vat26_first_expense_date))
  const diff = deadline.getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

export function getVat26Status(vehicle: Vehicle): 'not_required' | 'filed' | 'overdue' | 'urgent' | 'pending' | 'no_expense_date' {
  if (!vehicle.vat26_required) return 'not_required'
  if (vehicle.vat26_filed) return 'filed'
  if (!vehicle.vat26_first_expense_date) return 'no_expense_date'
  const days = daysUntilVat26(vehicle)
  if (days === null) return 'filed'
  if (days < 0) return 'overdue'
  if (days <= 7) return 'urgent'
  return 'pending'
}

export function formatVat26Deadline(firstExpenseDate: string): string {
  const deadline = getVat26Deadline(new Date(firstExpenseDate))
  return deadline.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
