import { type NextRequest } from 'next/server'
import { getBook } from '@/lib/appwrite/databases'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'
import { APPWRITE_DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/collections'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.userId) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  return Response.json({ book })
}

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book) return Response.json({ error: 'Livro não encontrado' }, { status: 404 })
  if (book.createdBy !== user.userId) return Response.json({ error: 'Acesso negado' }, { status: 403 })

  try {
    const { databases } = createAdminClient()
    await databases.deleteDocument(APPWRITE_DATABASE_ID, COLLECTIONS.BOOKS, id)
    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Falha ao deletar livro' }, { status: 500 })
  }
}
