import { type NextRequest } from 'next/server'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS, APPWRITE_DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/generate'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const { databases, functions } = createAdminClient()
  const chapterDoc = await databases.getDocument(APPWRITE_DATABASE_ID, COLLECTIONS.CHAPTERS, chapterId)
  if (chapterDoc.bookId !== id) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  if (chapterDoc.status === 'generating') {
    return Response.json({ error: 'Capítulo já está sendo gerado' }, { status: 409 })
  }

  try {
    await functions.createExecution(
      FUNCTIONS.GENERATE_CHAPTER,
      JSON.stringify({
        bookId: id,
        chapterId,
        planId: book.approvedPlanId,
        chapterNumber: chapterDoc.chapterNumber,
        paragraphsPerSection: book.paragraphsPerSection,
        citationStyle: book.citationStyle,
        bookTitle: book.title,
      }),
      true,
    )
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao iniciar geração' }, { status: 500 })
  }
}
