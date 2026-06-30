import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { getBook } from '@/lib/appwrite/databases'
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

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/assemble'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  if (!['generating_chapters', 'failed'].includes(book.status)) {
    return Response.json(
      { error: `Livro não está pronto para montagem (status: ${book.status})` },
      { status: 409 },
    )
  }

  const { createAdminClient } = await import('@/lib/appwrite/server')
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
