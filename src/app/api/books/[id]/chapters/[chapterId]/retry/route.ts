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
  request: Request,
  ctx: RouteContext<'/api/books/[id]/chapters/[chapterId]/retry'>,
) {
  const { id, chapterId } = await ctx.params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  let body: { step?: string } = {}
  try { body = await request.json() } catch { /* vazio */ }
  const step = body.step ?? 'generate'

  const { createAdminClient } = await import('@/lib/appwrite/server')
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
