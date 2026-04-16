import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Ignoruj:
     * - _next/static (pliki statyczne)
     * - _next/image (obrazy)
     * - favicon.ico
     * - setup (strona konfiguracji)
     * - api/setup (skrypt tworzenia konta)
     * - api/auth (logika logowania)
     */
    '/((?!_next/static|_next/image|favicon.ico|setup|api/setup|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}