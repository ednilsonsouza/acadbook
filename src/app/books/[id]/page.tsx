'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BookStatusBadge } from '@/components/book/book-status-badge'
import type { Book, BookStatus } from '@/types/book'

interface BookDetailPageProps {
  params: Promise<{ id: string }>
}

const STATUS_STEPS: { status: BookStatus; label: string }[] = [
  { status: 'draft', label: 'Criado' },
  { status: 'planning', label: 'Gerando plano' },
  { status: 'awaiting_plan_approval', label: 'Aguardando aprovação' },
  { status: 'plan_approved', label: 'Plano aprovado' },
  { status: 'generating_chapters', label: 'Gerando capítulos' },
  { status: 'assembling', label: 'Montando livro' },
  { status: 'exporting_pdf', label: 'Exportando PDF' },
  { status: 'completed', label: 'Concluído' },
]

function StepProgress({ currentStatus }: { currentStatus: BookStatus }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.status === currentStatus)
  const isFailed = currentStatus === 'failed'

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx < currentIndex
        const active = idx === currentIndex
        return (
          <div key={step.status} className="flex items-center gap-1 shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              done
                ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50'
                : active && !isFailed
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
            }`}>
              {done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : active && !isFailed ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {step.label}
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-slate-700 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function NextActionPanel({ book, onAction }: { book: Book; onAction: () => void }) {
  const [loading, setLoading] = useState(false)

  async function doAction(url: string) {
    setLoading(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error ?? 'Falha na operação')
      }
      toast.success('Operação iniciada com sucesso')
      onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha')
    } finally {
      setLoading(false)
    }
  }

  if (book.status === 'draft' || book.status === 'failed') {
    return (
      <Card className="border-blue-800/40 bg-blue-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            {book.status === 'draft'
              ? 'O livro está criado. Gere o plano para começar.'
              : 'Ocorreu uma falha. Tente gerar o plano novamente.'}
          </p>
          <Button onClick={() => doAction(`/api/books/${book.$id}/plan`)} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Iniciando...' : 'Gerar plano'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (book.status === 'awaiting_plan_approval') {
    return (
      <Card className="border-amber-800/40 bg-amber-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            O plano foi gerado. Revise e aprove para gerar os capítulos.
          </p>
          <ButtonLink href={`/books/${book.$id}/plan`} variant="secondary" className="gap-2">
            Revisar e aprovar plano
            <ChevronRight className="h-4 w-4" />
          </ButtonLink>
        </CardContent>
      </Card>
    )
  }

  if (book.status === 'generating_chapters') {
    return (
      <Card className="border-blue-800/40 bg-blue-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            Os capítulos estão sendo gerados. Acompanhe o progresso.
          </p>
          <ButtonLink href={`/books/${book.$id}/chapters`} className="gap-2">
            Ver capítulos
            <ChevronRight className="h-4 w-4" />
          </ButtonLink>
        </CardContent>
      </Card>
    )
  }

  if (book.status === 'assembling') {
    return (
      <Card className="border-purple-800/40 bg-purple-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            Todos os capítulos estão prontos. Monte o livro para continuar.
          </p>
          <Button onClick={() => doAction(`/api/books/${book.$id}/assemble`)} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Montando...' : 'Montar livro'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (book.status === 'exporting_pdf') {
    return (
      <Card className="border-indigo-800/40 bg-indigo-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            O livro está montado. Exporte para PDF premium.
          </p>
          <Button onClick={() => doAction(`/api/books/${book.$id}/export`)} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (book.status === 'completed' && book.pdfFileId) {
    return (
      <Card className="border-emerald-800/40 bg-emerald-950/20">
        <CardContent className="pt-4">
          <p className="text-sm text-slate-300 mb-3">
            Livro concluído. Visualize ou baixe o PDF.
          </p>
          <div className="flex gap-2">
            <ButtonLink href={`/books/${book.$id}/preview`} variant="secondary">
              Visualizar
            </ButtonLink>
            <ButtonLink href={`/books/${book.$id}/export`}>
              Baixar PDF
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

export default function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadBook() {
    try {
      const res = await fetch(`/api/books/${id}`, { credentials: 'same-origin' })
      if (res.status === 404) { setError('Livro não encontrado'); return }
      if (!res.ok) throw new Error()
      const data = await res.json() as { book: Book }
      setBook(data.book)
    } catch {
      setError('Falha ao carregar livro')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBook() }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="text-center py-24">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-slate-400">{error || 'Livro não encontrado'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/books')}>
          Voltar ao dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <ButtonLink href="/books" variant="ghost" size="icon" className="text-slate-400 hover:text-white mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </ButtonLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-white leading-tight">{book.title}</h1>
            <BookStatusBadge status={book.status} />
          </div>
          <p className="text-slate-400 text-sm">{book.authors}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadBook}
          className="text-slate-400 hover:text-white shrink-0"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/40 mb-6">
        <CardContent className="pt-4">
          <StepProgress currentStatus={book.status} />
        </CardContent>
      </Card>

      {book.status !== 'planning' && (
        <div className="mb-6">
          <NextActionPanel book={book} onAction={loadBook} />
        </div>
      )}

      <Card className="border-slate-800 bg-slate-900/40 mb-4">
        <CardHeader>
          <CardTitle className="text-white text-base">Dados do livro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-slate-500">Descrição</span>
            <p className="text-slate-300 mt-0.5">{book.description}</p>
          </div>
          <Separator className="bg-slate-800" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-500 text-xs">Capítulos</span>
              <p className="text-slate-200 font-medium">{book.chaptersCount}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Seções/cap.</span>
              <p className="text-slate-200 font-medium">{book.sectionsPerChapter}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Parágrafos/seção</span>
              <p className="text-slate-200 font-medium">{book.paragraphsPerSection}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Citação</span>
              <p className="text-slate-200 font-medium">{book.citationStyle}</p>
            </div>
          </div>
          <Separator className="bg-slate-800" />
          <div className="text-xs text-slate-600">
            Criado em {new Date(book.$createdAt).toLocaleString('pt-BR')}
          </div>
        </CardContent>
      </Card>

      {book.errorMessage && (
        <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 rounded-lg p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-0.5">Erro registrado</p>
            <p className="text-red-400/70">{book.errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}
