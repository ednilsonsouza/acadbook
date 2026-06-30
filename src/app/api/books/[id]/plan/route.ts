import { cookies } from 'next/headers'
import { Account, Client, Functions } from 'node-appwrite'
import { getBook, getLatestBookPlan, updateBookStatus } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'

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

// GET /api/books/[id]/plan — retorna o plano atual
export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  return Response.json({ plan })
}

// POST /api/books/[id]/plan — dispara geração do plano
export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.$id) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  if (!['draft', 'failed', 'awaiting_plan_approval'].includes(book.status)) {
    return Response.json(
      { error: `Não é possível gerar plano com status "${book.status}"` },
      { status: 409 },
    )
  }

  try {
    const { createAdminClient } = await import('@/lib/appwrite/server')
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
      true, // async
    )

    return Response.json({ success: true, message: 'Geração do plano iniciada' })
  } catch {
    return Response.json({ error: 'Falha ao iniciar geração do plano' }, { status: 500 })
  }
}

// PATCH /api/books/[id]/plan — atualiza capítulos do plano (edição pelo autor)
export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/books/[id]/plan'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  let body: { chapters?: unknown } = {}
  try { body = await request.json() } catch { /* vazio */ }

  try {
    const { updateBookPlan } = await import('@/lib/appwrite/databases')
    const { planChapterSchema } = await import('@/lib/validation/plan-schema')
    const { z } = await import('zod')

    const chaptersResult = z.array(planChapterSchema).safeParse(body.chapters)
    if (!chaptersResult.success) {
      return Response.json({ error: 'Estrutura de capítulos inválida' }, { status: 400 })
    }

    await updateBookPlan(plan.$id, { status: 'edited', chapters: chaptersResult.data })
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao atualizar plano' }, { status: 500 })
  }
}
