'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types/database'

interface UseProfileReturn {
  profile: Profile | null
  loading: boolean
  role: UserRole | null
  isAdmin: boolean
  isAccountant: boolean
  isDriver: boolean
  isAuditor: boolean
  canAddTrips: boolean
  canConfirmTrips: boolean
  canManageVehicles: boolean
  canViewReports: boolean
  canManageUsers: boolean
  canViewSimulation: boolean
  canManageDriverProfiles: boolean
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .schema('vat_km')
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [])

  const role = profile?.role ?? null

  return {
    profile,
    loading,
    role,
    isAdmin:       role === 'administrator',
    isAccountant:  role === 'ksiegowosc',
    isDriver:      role === 'kierowca',
    isAuditor:     role === 'kontrola',
    canAddTrips:             ['administrator', 'ksiegowosc', 'kierowca'].includes(role ?? ''),
    canConfirmTrips:         ['administrator', 'ksiegowosc'].includes(role ?? ''),
    canManageVehicles:       ['administrator'].includes(role ?? ''),
    canViewReports:          ['administrator', 'ksiegowosc', 'kontrola'].includes(role ?? ''),
    canManageUsers:          ['administrator'].includes(role ?? ''),
    canViewSimulation:       ['administrator', 'kierowca'].includes(role ?? ''),
    canManageDriverProfiles: ['administrator', 'kierowca'].includes(role ?? ''),
  }
}
