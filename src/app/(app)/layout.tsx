import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

async function getServerCounts(userId: string) {
  const supabase = await createClient()

  // Wpisy czekające na potwierdzenie
  const { count: pendingCount } = await supabase
    .schema('vat_km')
    .from('trip_entries')
    .select('*', { count: 'exact', head: true })
    .eq('requires_confirmation', true)
    .eq('confirmed_by_company', false)

  // Pojazdy bez VAT-26
  const { count: vat26Count } = await supabase
    .schema('vat_km')
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'aktywny')
    .eq('vat26_filed', false)
    .eq('vat26_required', true)

  return {
    pendingCount: pendingCount ?? 0,
    vat26Count: vat26Count ?? 0,
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { pendingCount, vat26Count } = await getServerCounts(user.id)

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar pendingCount={pendingCount} vat26Count={vat26Count} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
