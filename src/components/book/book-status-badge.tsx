import { Badge } from '@/components/ui/badge'
import type { BookStatus } from '@/types/book'

const STATUS_CONFIG: Record<BookStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  planning: { label: 'Gerando plano...', variant: 'secondary' },
  awaiting_plan_approval: { label: 'Aguardando aprovação', variant: 'secondary' },
  plan_approved: { label: 'Plano aprovado', variant: 'default' },
  generating_chapters: { label: 'Gerando capítulos...', variant: 'secondary' },
  assembling: { label: 'Montando livro...', variant: 'secondary' },
  exporting_pdf: { label: 'Exportando PDF...', variant: 'secondary' },
  completed: { label: 'Concluído', variant: 'default' },
  failed: { label: 'Falha', variant: 'destructive' },
}

interface BookStatusBadgeProps {
  status: BookStatus
}

export function BookStatusBadge({ status }: BookStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const }
  return (
    <Badge
      variant={config.variant}
      className={
        status === 'completed'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : status === 'failed'
            ? ''
            : status.includes('ing') || status === 'planning'
              ? 'bg-blue-600/20 text-blue-400 border-blue-600/30'
              : ''
      }
    >
      {config.label}
    </Badge>
  )
}
