// ============================================================
// Typy TypeScript — wygenerowane ze schematu vat_km Supabase
// Aby zaktualizowac: npm run supabase:types
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── ENUMS ───────────────────────────────────────────────────
export type UserRole = 'administrator' | 'ksiegowosc' | 'kierowca' | 'kontrola'
export type VehicleStatus = 'aktywny' | 'zakonczony' | 'zmieniony_sposob'
export type PeriodType = 'miesieczny' | 'kwartalny' | 'zamkniecie'
export type EntryType = 'wyjazd' | 'udostepnienie'
export type AuditAction = 'insert' | 'update' | 'delete' | 'confirm' | 'close_record' | 'vat26_filed'
export type Vat26Status = 'nie_wymagany' | 'zlozony' | 'brak_daty_wydatku' | 'po_terminie' | 'pilny' | 'oczekujacy'

// ─── SIMULATION CONFIG ────────────────────────────────────────
// Przechowywane jako JSONB w profiles.simulation_config

export type SimulationLocationType = 'siedziba' | 'dom' | 'klient' | 'inne'

export interface SimulationLocation {
  id:       string
  label:    string                  // display name, np. "Siedziba firmy", "Klient ABC"
  address:  string                  // pelny adres dla Google Maps API
  type:     SimulationLocationType
  purposes: string[]                // cele wizyt dla tej lokalizacji, np. ["Powrot do siedziby", "Wyjazd sluzbowy"]
}

export interface SimulationConfig {
  locations: SimulationLocation[]
}

// ─── TABLE TYPES ─────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  nip: string
  regon: string | null
  address: string | null
  created_at: string
}

export interface Profile {
  id: string
  company_id: string
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
  simulation_config: SimulationConfig | null
  created_at: string
}

export interface Vehicle {
  id: string
  company_id: string
  plate_number: string
  make: string
  model: string
  vin: string | null
  record_start_date: string
  odometer_start: number
  status: VehicleStatus
  vat26_required: boolean
  vat26_filed: boolean
  vat26_first_expense_date: string | null
  vat26_deadline: string | null
  vat26_filed_date: string | null
  vat26_notes: string | null
  record_end_date: string | null
  odometer_end: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TripEntry {
  id: string
  vehicle_id: string
  driver_id: string | null
  driver_name_external: string | null
  entry_number: number
  entry_type: EntryType
  trip_date: string
  purpose: string
  route_from: string
  route_to: string
  odometer_before: number
  odometer_after: number
  kilometers: number | null  // generated column
  requires_confirmation: boolean
  confirmed_by_company: boolean
  confirmed_by: string | null
  confirmed_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface VehicleLoan {
  id: string
  vehicle_id: string
  entry_number: number
  loan_date: string
  purpose: string
  loaned_to_name: string
  loaned_to_user_id: string | null
  odometer_at_issue: number
  odometer_at_return: number | null
  kilometers: number | null  // generated column
  return_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface OdometerSnapshot {
  id: string
  vehicle_id: string
  period_year_month: string  // 'YYYY-MM'
  period_type: PeriodType
  odometer_reading: number
  km_in_period: number | null
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  changed_by: string | null
  changed_by_name: string | null
  old_values: Json | null
  new_values: Json | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ─── VIEW TYPES ───────────────────────────────────────────────

export interface MonthlySummaryRow {
  vehicle_id: string
  plate_number: string
  make: string
  model: string
  company_id: string
  year_month: string
  trip_count: number
  total_km: number
  odometer_period_start: number | null
  odometer_period_end: number | null
  pending_confirmations: number
}

export interface DriverSummaryRow {
  driver_id: string | null
  driver_name: string | null
  company_id: string
  vehicle_id: string
  plate_number: string
  year_month: string
  trip_count: number
  total_km: number
}

export interface Vat26ComplianceRow {
  id: string
  plate_number: string
  make: string
  model: string
  company_id: string
  status: VehicleStatus
  vat26_required: boolean
  vat26_filed: boolean
  vat26_first_expense_date: string | null
  vat26_deadline: string | null
  vat26_filed_date: string | null
  vat26_status: Vat26Status
  days_until_deadline: number | null
}

export interface PendingConfirmationRow {
  id: string
  vehicle_id: string
  plate_number: string
  vehicle_name: string
  entry_number: number
  trip_date: string
  purpose: string
  route_from: string
  route_to: string
  kilometers: number | null
  driver_name_external: string | null
  created_at: string
  company_id: string
}

// ─── FORM INPUT TYPES ─────────────────────────────────────────

export interface TripEntryFormData {
  vehicle_id: string
  trip_date: string
  purpose: string
  route_from: string
  route_to: string
  odometer_before: number
  odometer_after: number
  driver_id?: string
  driver_name_external?: string
  notes?: string
}

export interface VehicleFormData {
  plate_number: string
  make: string
  model: string
  vin?: string
  record_start_date: string
  odometer_start: number
  vat26_first_expense_date?: string
}

export interface VehicleLoanFormData {
  vehicle_id: string
  loan_date: string
  purpose: string
  loaned_to_name: string
  loaned_to_user_id?: string
  odometer_at_issue: number
  odometer_at_return?: number
  return_date?: string
  notes?: string
}

// ─── API RESPONSE TYPES ───────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}

export interface DashboardStats {
  activeVehicles: number
  totalKmThisMonth: number
  pendingConfirmations: number
  vat26Alerts: number
}
