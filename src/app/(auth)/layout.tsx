import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">AcadBook</h1>
          <p className="text-slate-400 mt-1 text-sm">Gerador de livros acadêmicos com IA</p>
        </div>
        {children}
      </div>
    </div>
  )
}
