'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

const NAV = [
  {
    group: 'Główne',
    items: [
      { href: '/dashboard',  label: 'Dashboard',       icon: '▦' },
      { href: '/pojazdy',    label: 'Pojazdy',          icon: '◈' },
      { href: '/wpisy',      label: 'Ewidencja',        icon: '≡', badge: 'pending' },
    ],
  },
  {
    group: 'Raporty',
    items: [
      { href: '/raporty',    label: 'Zestawienia',      icon: '◫' },
    ],
  },
  {
    group: 'Compliance',
    items: [
      { href: '/compliance', label: 'VAT-26 / Alerty',  icon: '!', badge: 'vat26' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { href: '/admin',      label: 'Użytkownicy',      icon: '⊕', adminOnly: true },
    ],
  },
]

interface SidebarProps {
  pendingCount?: number
  vat26Count?: number
}

export function Sidebar({ pendingCount = 0, vat26Count = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, isAdmin } = useProfile()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const badges: Record<string, number> = {
    pending: pendingCount,
    vat26: vat26Count,
  }

  return (
    <aside className="flex-shrink-0 flex flex-col h-full" style={{ width: 210, background: '#0f172a' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid #1e293b' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-blue-700">
          KM
        </div>
        <div>
          <p className="text-white text-xs font-semibold leading-tight">EwidencjaVAT</p>
          <p className="text-xs" style={{ color: '#475569' }}>art. 86a ustawy o VAT</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(group => {
          // Filtruj pozycje admin-only
          const items = group.items.filter(i => !i.adminOnly || isAdmin)
          if (!items.length) return null

          return (
            <div key={group.group}>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest"
                 style={{ color: '#334155' }}>
                {group.group}
              </p>
              {items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badgeCount = item.badge ? badges[item.badge] : 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      width: 'calc(100% - 8px)',
                      background: active ? '#1d4ed8' : 'transparent',
                      color: active ? '#fff' : '#94a3b8',
                    }}
                  >
                    <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: '#ef4444', color: '#fff' }}>
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3" style={{ borderTop: '1px solid #1e293b' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-blue-700">
            {profile?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2) ?? '??'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{profile?.full_name ?? '…'}</p>
            <p className="text-xs truncate" style={{ color: '#475569' }}>
              {profile?.role === 'administrator' ? 'Administrator'
               : profile?.role === 'ksiegowosc' ? 'Księgowość'
               : profile?.role === 'kierowca' ? 'Kierowca'
               : 'Kontrola'}
            </p>
          </div>
          <span className="text-xs" style={{ color: '#475569' }}>↩</span>
        </button>
      </div>
    </aside>
  )
}
