'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GuardPending {
  vehicleId: string
  context:   string
  action:    () => void | Promise<void>
}

/**
 * Guard fires when the user acts on a vehicle that is not their default assigned vehicle.
 * - myDefaultVehicleId: null → guard never activates (user has no assigned vehicle)
 * - getVehicleLabel(id): returns display string for a vehicle id ("CB 330TX — Lexus ES 300H")
 * Returns { guard, GuardModal }:
 *   - guard(vehicleId, context, action): calls action immediately if no guard needed,
 *     otherwise opens the confirmation modal; after confirm runs RPC then calls action.
 *   - GuardModal: JSX element (or null) — render it anywhere in the component tree.
 */
export function useCrossVehicleGuard({
  myDefaultVehicleId,
  getVehicleLabel,
}: {
  myDefaultVehicleId: string | null
  getVehicleLabel:    (id: string) => string
}) {
  const [pending,    setPending]    = useState<GuardPending | null>(null)
  const [rpcError,   setRpcError]   = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function guard(vehicleId: string, context: string, action: () => void | Promise<void>) {
    if (!myDefaultVehicleId || vehicleId === myDefaultVehicleId) {
      void Promise.resolve(action())
      return
    }
    setRpcError(null)
    setPending({ vehicleId, context, action })
  }

  async function doConfirm() {
    if (!pending) return
    setConfirming(true)
    setRpcError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .schema('vat_km')
        .rpc('log_cross_vehicle_ack', {
          p_vehicle_id: pending.vehicleId,
          p_context:    pending.context,
        })
      if (error) {
        setRpcError(error.message)
        setConfirming(false)
        return
      }
      const { action } = pending
      setPending(null)
      await Promise.resolve(action())
    } catch (e: unknown) {
      setRpcError((e as Error)?.message ?? 'Błąd połączenia z serwerem')
      setConfirming(false)
    }
  }

  function doCancel() {
    setPending(null)
    setRpcError(null)
    setConfirming(false)
  }

  const GuardModal = pending ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">Potwierdzenie operacji</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-700">
            Ta operacja dotyczy pojazdu{' '}
            <strong className="font-mono">{getVehicleLabel(pending.vehicleId)}</strong>,{' '}
            który NIE jest Twoim przypisanym autem{' '}
            (<span className="font-mono font-semibold">{getVehicleLabel(myDefaultVehicleId!)}</span>).{' '}
            Potwierdź, że wykonujesz ją świadomie.
          </p>
          {rpcError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              Błąd audytu: {rpcError}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={doCancel} disabled={confirming} className="btn-outline">Anuluj</button>
          <button onClick={() => void doConfirm()} disabled={confirming} className="btn-primary">
            {confirming ? 'Zapisywanie…' : 'Potwierdzam — wykonaj'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { guard, GuardModal }
}
