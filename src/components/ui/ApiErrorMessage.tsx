'use client'

import Link from 'next/link'
import type { DbError } from '@/lib/errors/db-errors'

interface Props {
  error: DbError | string | null
}

export function ApiErrorMessage({ error }: Props) {
  if (!error) return null
  const err: DbError = typeof error === 'string'
    ? { code: 'db_error', message: error, hint: '' }
    : error

  if (err.code === 'sequence_missing') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-800 space-y-1">
        <p className="font-medium">&#x2139; {err.message}</p>
        <p className="text-xs">{err.hint}</p>
        <p className="text-xs"><Link href="/wpisy/nowy" className="underline font-medium">Dodaj pierwszy wpis recznie &#x2192;</Link></p>
      </div>
    )
  }
  if (err.code === 'odometer_continuity') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800 space-y-1">
        <p className="font-medium">&#x26A0; {err.message}</p>
        <p className="text-xs">{err.hint}</p>
        <p className="text-xs"><Link href="/wpisy" className="underline font-medium">Sprawdz ewidencje &#x2192;</Link></p>
      </div>
    )
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
      {err.message}
    </div>
  )
}
