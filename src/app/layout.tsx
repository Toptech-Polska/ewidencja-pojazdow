import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EwidencjaVAT — art. 86a ustawy o VAT',
  description: 'Ewidencja przebiegu pojazdów firmowych zgodna z art. 86a ustawy o VAT',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  )
}
