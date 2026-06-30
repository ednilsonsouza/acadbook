import { type NextRequest } from 'next/server'
import { getBook, getLatestBookPlan } from '@/lib/appwrite/databases'
import { FUNCTIONS, APPWRITE_DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'
import type { PlanChapter } from '@/types/plan'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/research'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  const { databases, functions } = createAdminClient()
  const chapterDoc = await databases.getDocument(APPWRITE_DATABASE_ID, COLLECTIONS.CHAPTERS, chapterId)
  if (chapterDoc.bookId !== id) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  const planChapters = plan.chapters as PlanChapter[]
  const chapterPlan = planChapters.find((c) => c.chapterNumber === chapterDoc.chapterNumber)
  if (!chapterPlan) return Response.json({ error: 'Capítulo não encontrado no plano' }, { status: 404 })

  try {
    await functions.createExecution(
      FUNCTIONS.RESEARCH_CHAPTER,
      JSON.stringify({
        bookId: id,
        chapterId,
        chapterTitle: chapterPlan.title,
        chapterObjective: chapterPlan.objective,
        chapterKeywords: chapterPlan.keywords,
        sections: chapterPlan.sections,
        bookTitle: book.title,
      }),
      true,
    )
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao iniciar pesquisa' }, { status: 500 })
  }
}
