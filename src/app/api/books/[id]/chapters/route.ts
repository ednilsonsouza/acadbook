import { type NextRequest } from 'next/server'
import { getBook, getChaptersByBook } from '@/lib/appwrite/databases'
import { getAuthUser } from '@/lib/appwrite/api-auth'

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/chapters'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const chapters = await getChaptersByBook(id)
  return Response.json({ chapters })
}
