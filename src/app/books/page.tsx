'use client'

import { useEffect, useState } from 'react'
import { Plus, BookOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { BookCard } from '@/components/book/book-card'
import type { Book } from '@/types/book'

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadBooks() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/books', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Falha ao carregar livros')
      const data = await res.json() as { books: Book[] }
      setBooks(data.books)
    } catch {
      setError('Não foi possível carregar seus livros. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus livros</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {loading ? 'Carregando...' : `${books.length} livro${books.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={loadBooks}
            disabled={loading}
            className="text-slate-400 hover:text-white"
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <ButtonLink href="/books/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo livro
          </ButtonLink>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-lg bg-slate-800/50 animate-pulse border border-slate-700"
            />
          ))}
        </div>
      )}

      {!loading && books.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <BookCard key={book.$id} book={book} />
          ))}
        </div>
      )}

      {!loading && books.length === 0 && !error && (
        <div className="text-center py-24 border border-slate-800 border-dashed rounded-xl">
          <BookOpen className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-slate-400 font-medium mb-2">Nenhum livro ainda</h3>
          <p className="text-slate-600 text-sm mb-6">
            Crie seu primeiro livro acadêmico com IA
          </p>
          <ButtonLink href="/books/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar primeiro livro
          </ButtonLink>
        </div>
      )}
    </div>
  )
}
