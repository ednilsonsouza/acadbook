import { type NextRequest } from 'next/server'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/assemble'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  if (!['generating_chapters', 'failed'].includes(book.status)) {
    return Response.json(
      { error: `Livro não está pronto para montagem (status: ${book.status})` },
      { status: 409 },
    )
  }

  const { functions } = createAdminClient()

  try {
    await functions.createExecution(
      FUNCTIONS.ASSEMBLE_BOOK,
      JSON.stringify({ bookId: id, planId: book.approvedPlanId }),
      true,
    )
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao iniciar montagem' }, { status: 500 })
  }
}
