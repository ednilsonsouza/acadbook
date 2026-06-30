import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS } from '@/lib/appwrite/collections'

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
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/generate'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const { createAdminClient } = await import('@/lib/appwrite/server')
  const { APPWRITE_DATABASE_ID, COLLECTIONS } = await import('@/lib/appwrite/collections')
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
