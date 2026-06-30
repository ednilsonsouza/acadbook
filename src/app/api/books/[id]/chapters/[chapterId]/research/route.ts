import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { getBook, getLatestBookPlan } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'
import type { PlanChapter } from '@/types/plan'

const SESSION_COOKIE = 'acadbook-session'

async function getAuthUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(token)
    return await new Account(client).get()
  } catch { return null }
}

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/research'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const plan = await getLatestBookPlan(id)
  if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 })

  // Buscar dados do capítulo no banco
  const { createAdminClient } = await import('@/lib/appwrite/server')
  const { APPWRITE_DATABASE_ID, COLLECTIONS } = await import('@/lib/appwrite/collections')
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
