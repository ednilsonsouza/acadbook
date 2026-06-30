import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getBook, getLatestBookPlan, updateBookPlan } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'
import { planChapterSchema } from '@/lib/validation/plan-schema'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  return Response.json({ plan })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.userId) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  if (!['draft', 'failed', 'awaiting_plan_approval'].includes(book.status)) {
    return Response.json(
      { error: `Não é possível gerar plano com status "${book.status}"` },
      { status: 409 },
    )
  }

  try {
    const { functions } = createAdminClient()
    await functions.createExecution(
      FUNCTIONS.GENERATE_PLAN,
      JSON.stringify({
        bookId: id,
        title: book.title,
        description: book.description,
        authors: book.authors,
        chaptersCount: book.chaptersCount,
        sectionsPerChapter: book.sectionsPerChapter,
      }),
      true,
    )
    return Response.json({ success: true, message: 'Geração do plano iniciada' })
  } catch {
    return Response.json({ error: 'Falha ao iniciar geração do plano' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  let body: { chapters?: unknown } = {}
  try { body = await request.json() } catch { /* vazio */ }

  const chaptersResult = z.array(planChapterSchema).safeParse(body.chapters)
  if (!chaptersResult.success) {
    return Response.json({ error: 'Estrutura de capítulos inválida' }, { status: 400 })
  }

  try {
    await updateBookPlan(plan.$id, { status: 'edited', chapters: chaptersResult.data })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao atualizar plano' }, { status: 500 })
  }
}
