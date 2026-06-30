import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { getBook, getChaptersByBook } from '@/lib/appwrite/databases'

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

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/books/[id]/chapters'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const chapters = await getChaptersByBook(id)
  return Response.json({ chapters })
}
