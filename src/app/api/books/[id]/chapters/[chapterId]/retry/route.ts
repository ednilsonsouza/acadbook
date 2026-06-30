import { type NextRequest } from 'next/server'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/retry'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  let body: { step?: string } = {}
  try { body = await request.json() } catch { /* vazio */ }
  const step = body.step ?? 'generate'

  const { functions } = createAdminClient()

  try {
    await functions.createExecution(
      FUNCTIONS.RETRY_GENERATION,
      JSON.stringify({
        bookId: id,
        chapterId,
        step,
        planId: book.approvedPlanId,
        paragraphsPerSection: book.paragraphsPerSection,
        citationStyle: book.citationStyle,
        bookTitle: book.title,
      }),
      true,
    )
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao iniciar retry' }, { status: 500 })
  }
}
