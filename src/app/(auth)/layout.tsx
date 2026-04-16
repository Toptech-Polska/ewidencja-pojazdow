export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center bg-slate-50 p-4">
      {children}
    </div>
  )
}
