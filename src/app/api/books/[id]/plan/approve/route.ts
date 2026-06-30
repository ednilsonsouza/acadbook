import { type NextRequest } from 'next/server'
import {
  getBook,
  getLatestBookPlan,
  updateBookPlan,
  updateBookStatus,
  createChapterRecords,
} from '@/lib/appwrite/databases'
import type { PlanChapter } from '@/types/plan'
import { getAuthUser } from '@/lib/appwrite/api-auth'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/plan/approve'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  if (book.status !== 'awaiting_plan_approval') {
    return Response.json(
      { error: `Livro não está aguardando aprovação (status: ${book.status})` },
      { status: 409 },
    )
  }

  const plan = await getLatestBookPlan(id)
  if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  try {
    const now = new Date().toISOString()
    await updateBookPlan(plan.$id, { status: 'approved', approvedAt: now })
    await createChapterRecords(id, plan.$id, book.chaptersCount, plan.chapters as PlanChapter[])
    await updateBookStatus(id, 'generating_chapters', { approvedPlanId: plan.$id })
    return Response.json({ success: true, planId: plan.$id })
  } catch {
    return Response.json({ error: 'Falha ao aprovar plano' }, { status: 500 })
  }
}
