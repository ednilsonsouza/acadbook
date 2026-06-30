import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getBook, getLatestBookPlan, updateBookPlan, updateBookStatus, createBookPlan, logGeneration } from '@/lib/appwrite/databases'
import { getAuthUser } from '@/lib/appwrite/api-auth'
import { planChapterSchema } from '@/lib/validation/plan-schema'
import { generateBookPlan } from '@/lib/minimax/generate-text'
import type { PlanChapter } from '@/types/plan'

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
    // Atualizar status para planning
    await updateBookStatus(id, 'planning')

    // Gerar plano via MiniMax diretamente
    const generated = await generateBookPlan({
      title: book.title,
      description: book.description,
      authors: book.authors,
      chaptersCount: book.chaptersCount,
      sectionsPerChapter: book.sectionsPerChapter,
    })

    // Verificar versão do plano
    const existingPlan = await getLatestBookPlan(id)
    const version = existingPlan ? existingPlan.version + 1 : 1

    // Salvar plano
    const plan = await createBookPlan({
      bookId: id,
      version,
      chapters: generated.chapters as PlanChapter[],
    })

    // Atualizar status do livro
    await updateBookStatus(id, 'awaiting_plan_approval')

    // Log
    await logGeneration({
      bookId: id,
      agent: 'generate-book-plan',
      step: 'minimax_plan',
      status: 'success',
      message: `Plano v${version} gerado com ${generated.chapters.length} capítulos`,
    })

    return Response.json({ success: true, planId: plan.$id, version })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await updateBookStatus(id, 'failed', { errorMessage: message.slice(0, 500) })
    await logGeneration({
      bookId: id,
      agent: 'generate-book-plan',
      step: 'minimax_plan',
      status: 'error',
      message: message.slice(0, 500),
    })
    return Response.json({ error: 'Falha ao gerar plano', detail: message }, { status: 500 })
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
