import { BookOpen, Calendar, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button-link'
import { BookStatusBadge } from './book-status-badge'
import type { Book } from '@/types/book'

interface BookCardProps {
  book: Book
}

const STATUS_NEXT_ACTION: Record<string, string> = {
  draft: 'Gerar plano',
  awaiting_plan_approval: 'Revisar plano',
  plan_approved: 'Gerar capítulos',
  generating_chapters: 'Ver progresso',
  assembling: 'Aguardando montagem',
  exporting_pdf: 'Aguardando PDF',
  completed: 'Ver livro',
  failed: 'Tentar novamente',
}

export function BookCard({ book }: BookCardProps) {
  const nextAction = STATUS_NEXT_ACTION[book.status] ?? 'Abrir'

  return (
    <Card className="group flex flex-col border-slate-700 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-500 transition-all duration-200 shadow-sm hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-blue-400 shrink-0" />
            <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-blue-300 transition-colors">
              {book.title}
            </h3>
          </div>
          <BookStatusBadge status={book.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <p className="text-slate-400 text-xs line-clamp-2 mb-3">{book.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{book.chaptersCount} capítulos</span>
          <span>{book.sectionsPerChapter} seções/cap.</span>
          <span>{book.citationStyle}</span>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-slate-600">
          <Calendar className="h-3 w-3" />
          <span>{new Date(book.$createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
        {book.status === 'failed' && book.errorMessage && (
          <p className="mt-2 text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded px-2 py-1 line-clamp-2">
            {book.errorMessage}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <ButtonLink
          href={`/books/${book.$id}`}
          size="sm"
          variant="secondary"
          className="w-full flex items-center justify-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors"
        >
          {nextAction}
          <ChevronRight className="h-4 w-4" />
        </ButtonLink>
      </CardFooter>
    </Card>
  )
}
