'use server'

import { createAdminClient } from '@/lib/supabase/server'

/**
 * Jednorazowy seed — tworzy pierwsze konto administratora.
 * Wywołaj po deploymencie przez dedykowaną stronę /setup
 * lub przez supabase dashboard.
 *
 * UWAGA: Po utworzeniu pierwszego admina usuń lub zabezpiecz /setup.
 */
export async function createFirstAdmin(formData: FormData) {
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const companyName = formData.get('companyName') as string
  const nip      = formData.get('nip')      as string

  const supabase = await createAdminClient()

  // 1. Utwórz firmę
  const { data: company, error: compErr } = await supabase
    .schema('vat_km')
    .from('companies')
    .insert({ name: companyName, nip })
    .select()
    .single()

  if (compErr) return { error: compErr.message }

  // 2. Utwórz użytkownika w Auth
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr) return { error: authErr.message }

  // 3. Utwórz profil
  const { error: profileErr } = await supabase
    .schema('vat_km')
    .from('profiles')
    .insert({
      id:         authUser.user.id,
      company_id: company.id,
      full_name:  fullName,
      email,
      role:       'administrator',
    })

  if (profileErr) return { error: profileErr.message }

  return { success: true, companyId: company.id }
}
