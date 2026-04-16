import Link from 'next/link'

interface TopbarProps {
  title: string
  action?: {
    label: string
    href: string
  }
}

export function Topbar({ title, action }: TopbarProps) {
  return (
    <header
      className="flex-shrink-0 flex items-center gap-3 px-5 bg-white"
      style={{ height: 52, borderBottom: '1px solid #e2e8f0' }}
    >
      <h1 className="text-sm font-semibold text-slate-800 flex-1">{title}</h1>
      {action && (
        <Link href={action.href} className="btn-primary text-xs py-1.5 px-3">
          {action.label}
        </Link>
      )}
    </header>
  )
}
