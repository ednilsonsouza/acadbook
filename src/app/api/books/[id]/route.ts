import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { getBook, updateBookStatus } from '@/lib/appwrite/databases'

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
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.$id) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  return Response.json({ book })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.$id) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  try {
    const { createAdminClient } = await import('@/lib/appwrite/server')
    const { APPWRITE_DATABASE_ID, COLLECTIONS } = await import('@/lib/appwrite/collections')
    const { databases } = createAdminClient()
    await databases.deleteDocument(APPWRITE_DATABASE_ID, COLLECTIONS.BOOKS, id)
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao deletar livro' }, { status: 500 })
  }
}
