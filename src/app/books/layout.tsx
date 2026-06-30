import type { ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { NavUserMenu } from '@/components/book/nav-user-menu'

export default function BooksLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/books" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <BookOpen className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-lg tracking-tight">AcadBook</span>
          </Link>
          <NavUserMenu />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
