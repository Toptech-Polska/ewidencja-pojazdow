import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { FiledVat26Button } from './FiledVat26Button'
import type { Vat26ComplianceRow } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; badge: string; border: string; icon: string }> = {
  overdue:         { label: 'Po terminie!',          badge: 'badge-danger', border: '#ef4444', icon: '!' },
  urgent:          { label: 'Termin za 7 dni',        badge: 'badge-danger', border: '#ef4444', icon: '!' },
  pending:         { label: 'Oczekujący',             badge: 'badge-warn',   border: '#f59e0b', icon: '⚠' },
  filed:           { label: 'Złożony',                badge: 'badge-ok',     border: '#10b981', icon: '✓' },
  not_required:    { label: 'Nie wymagany',           badge: 'badge-gray',   border: '#e2e8f0', icon: '—' },
  no_expense_date: { label: 'Brak daty wydatku',      badge: 'badge-warn',   border: '#f59e0b', icon: '⚠' },
}

const FALLBACK_CFG = { label: 'Nieznany', badge: 'badge-gray', border: '#e2e8f0', icon: '—' }
const getCfg = (status: string | null | undefined) => STATUS_CONFIG[status ?? ''] ?? FALLBACK_CFG

export default async function CompliancePage() {
  const supabase = await createClient()

  const { data: compliance } = await supabase
    .schema('vat_km')
    .from('v_vat26_compliance')
    .select('*')
    .order('vat26_deadline', { ascending: true, nullsFirst: false })

  const alerts = (compliance ?? []).filter(c =>
    ['overdue', 'urgent', 'pending', 'no_expense_date'].includes(c.vat26_status ?? '')
  )

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Centrum compliance — art. 86a ustawy o VAT" />

      <div className="main-scroll p-5 space-y-4">
        {/* Alerty */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Wymagane działania</span>
            {alerts.length > 0 && (
              <span className="badge badge-danger">{alerts.length} aktywnych</span>
            )}
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.length === 0 && (
              <div className="flex gap-3 p-4" style={{ borderLeft: '3px solid #10b981' }}>
                <div className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-sm bg-green-50 text-green-600">✓</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Wszystko w porządku</p>
                  <p className="text-xs text-slate-500 mt-0.5">Brak aktywnych alertów VAT-26 ani wpisów do potwierdzenia</p>
                </div>
              </div>
            )}
            {alerts.map(c => {
              const cfg = getCfg(c.vat26_status)
              return (
                <div key={c.id} className="flex gap-3 p-4" style={{ borderLeft: `3px solid ${cfg.border}` }}>
                  <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-sm
                    ${cfg.badge === 'badge-danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      VAT-26 do złożenia — {c.plate_number} ({c.make} {c.model})
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pierwszy wydatek: {c.vat26_first_expense_date ? new Date(c.vat26_first_expense_date).toLocaleDateString('pl-PL') : '—'}
                      {c.vat26_deadline && ` · Termin: ${new Date(c.vat26_deadline).toLocaleDateString('pl-PL')}`}
                      {c.days_until_deadline !== null && c.days_until_deadline >= 0 && ` · Pozostało: ${c.days_until_deadline} dni`}
                      {c.days_until_deadline !== null && c.days_until_deadline < 0 && ` · Przekroczono o ${Math.abs(c.days_until_deadline)} dni`}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <FiledVat26Button
                        vehicleId={c.id}
                        plateNumber={c.plate_number}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela statusu */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Status VAT-26 — wszystkie pojazdy</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pojazd</th>
                  <th>Ewidencja od</th>
                  <th>Pierwszy wydatek</th>
                  <th>Termin VAT-26</th>
                  <th>Data złożenia</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(compliance ?? []).map(c => {
                  const cfg = getCfg(c.vat26_status)
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/pojazdy/${c.id}`} className="font-mono font-bold text-slate-900 text-xs hover:text-blue-700">
                          {c.plate_number}
                        </Link>
                        <span className="ml-2 text-slate-400 text-xs">{c.make} {c.model}</span>
                      </td>
                      <td className="text-slate-500 text-xs">
                        {new Date(c.record_start_date ?? '').toLocaleDateString('pl-PL')}
                      </td>
                      <td className="text-xs text-slate-500">
                        {c.vat26_first_expense_date
                          ? new Date(c.vat26_first_expense_date).toLocaleDateString('pl-PL')
                          : '—'}
                      </td>
                      <td className={`text-xs font-medium ${
                        c.vat26_status === 'overdue' ? 'text-red-600' :
                        c.vat26_status === 'urgent'  ? 'text-red-500' : ''
                      }`}>
                        {c.vat26_deadline
                          ? new Date(c.vat26_deadline).toLocaleDateString('pl-PL')
                          : '—'}
                      </td>
                      <td className="text-xs text-slate-500">
                        {c.vat26_filed_date
                          ? new Date(c.vat26_filed_date).toLocaleDateString('pl-PL')
                          : '—'}
                      </td>
                      <td>
                        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
