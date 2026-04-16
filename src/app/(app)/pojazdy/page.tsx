import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'

export default async function PojazdyPage() {
  const supabase = await createClient()

  const { data: vehicles } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .select('*')
    .order('created_at')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Flota pojazdów" action={{ label: '+ Dodaj pojazd', href: '/pojazdy/nowy' }} />

      <div className="main-scroll p-5">
        {!vehicles?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">◈</div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Brak pojazdów</h2>
            <p className="text-sm text-slate-400 mb-6">Dodaj pierwszy pojazd do ewidencji</p>
            <Link href="/pojazdy/nowy" className="btn-primary">+ Dodaj pojazd</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {vehicles.map(v => {
              const kmTotal = v.odometer_end
                ? v.odometer_end - v.odometer_start
                : null

              return (
                <Link
                  key={v.id}
                  href={`/pojazdy/${v.id}`}
                  className="card p-5 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-xl font-bold text-slate-900 tracking-wide">{v.plate_number}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{v.make} {v.model}</p>
                    </div>
                    <div>
                      {v.status === 'aktywny' && v.vat26_filed && (
                        <span className="badge badge-ok">Aktywny</span>
                      )}
                      {v.status === 'aktywny' && !v.vat26_filed && v.vat26_required && (
                        <span className="badge badge-warn">Brak VAT-26</span>
                      )}
                      {v.status === 'aktywny' && !v.vat26_required && (
                        <span className="badge badge-ok">Aktywny</span>
                      )}
                      {v.status === 'zakonczony' && (
                        <span className="badge badge-gray">Zakończony</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 py-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Ewidencja od</p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">
                        {new Date(v.record_start_date).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Licznik startowy</p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">
                        {v.odometer_start.toLocaleString('pl-PL')} km
                      </p>
                    </div>
                    {v.vin && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">VIN</p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">{v.vin.slice(-8)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">VAT-26</span>
                    {v.vat26_filed
                      ? <span className="text-xs text-green-700 font-semibold">✓ Złożony {v.vat26_filed_date ? new Date(v.vat26_filed_date).toLocaleDateString('pl-PL') : ''}</span>
                      : v.status === 'aktywny' && v.vat26_required
                        ? <span className="text-xs text-red-600 font-semibold">⚠ Do złożenia: {v.vat26_deadline ? new Date(v.vat26_deadline).toLocaleDateString('pl-PL') : '—'}</span>
                        : <span className="text-xs text-slate-400">—</span>
                    }
                  </div>
                </Link>
              )
            })}

            {/* Add new card */}
            <Link
              href="/pojazdy/nowy"
              className="rounded-xl border-2 border-dashed border-slate-200 p-5 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-3 min-h-44 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-2xl font-light">+</div>
              <p className="text-sm text-slate-500 font-medium">Dodaj pojazd</p>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
