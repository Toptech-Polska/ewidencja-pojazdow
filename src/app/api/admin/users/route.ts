import { NextResponse } from 'next/server'

// LEGACY ENDPOINT — usunięty.
// Tworzenie użytkowników z hasłem zostało zastąpione przez automatyczne
// tworzenie profilu przy pierwszym logowaniu Google (trigger SQL
// vat_km.handle_new_user). Whitelist zarządzany jest przez
// /api/admin/whitelist, role nadawane przez PATCH /api/profiles/[id].
//
// Plik można bezpiecznie usunąć po zmergowaniu PR.

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Endpoint usunięty. Użytkownicy są tworzeni automatycznie przy pierwszym logowaniu Google. ' +
        'Aby dodać dostęp: dopisz email do whitelist (/api/admin/whitelist), ' +
        'a po pierwszym logowaniu nadaj rolę przez panel admina.',
    },
    { status: 410 },
  )
}
