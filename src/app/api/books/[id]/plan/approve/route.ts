import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import {
  getBook,
  getLatestBookPlan,
  updateBookPlan,
  updateBookStatus,
  createChapterRecords,
} from '@/lib/appwrite/databases'
import type { PlanChapter } from '@/types/plan'

const SESSION_COOKIE = 'acadbook-session'

async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setSession(token)
    return await new Account(client).get()
  } catch { return null }
}

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/plan/approve'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
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

    // Marcar plano como aprovado
    await updateBookPlan(plan.$id, { status: 'approved', approvedAt: now })

    // Criar registros de capítulos (um por capítulo do plano)
    await createChapterRecords(id, plan.$id, book.chaptersCount, plan.chapters as PlanChapter[])

    // Atualizar status do livro
    await updateBookStatus(id, 'generating_chapters', { approvedPlanId: plan.$id })

    return Response.json({ success: true, planId: plan.$id })
  } catch {
    return Response.json({ error: 'Falha ao aprovar plano' }, { status: 500 })
  }
}
