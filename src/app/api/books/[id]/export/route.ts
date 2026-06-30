import { cookies } from 'next/headers'
import { Account, Client, ID } from 'node-appwrite'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS, APPWRITE_DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/collections'

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
  ctx: RouteContext<'/api/books/[id]/export'>,
) {
  const { id } = await ctx.params
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.$id) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  if (book.status !== 'exporting_pdf' && book.status !== 'assembling') {
    return Response.json(
      { error: `Livro não está pronto para exportação (status: ${book.status})` },
      { status: 409 },
    )
  }

  const { createAdminClient } = await import('@/lib/appwrite/server')
  const { databases, functions } = createAdminClient()

  try {
    // Criar registro de exportação
    const exportDoc = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      COLLECTIONS.EXPORTS,
      ID.unique(),
      {
        bookId: id,
        format: 'pdf',
        fileId: null,
        status: 'pending',
        errorMessage: null,
        templateId: book.templateId ?? 'academic-classic',
      },
    )

    await functions.createExecution(
      FUNCTIONS.EXPORT_PDF,
      JSON.stringify({ bookId: id, exportId: exportDoc.$id }),
      true,
    )

    return Response.json({ success: true, exportId: exportDoc.$id })
  } catch {
    return Response.json({ error: 'Falha ao iniciar exportação' }, { status: 500 })
  }
}
