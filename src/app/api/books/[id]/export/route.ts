import { type NextRequest } from 'next/server'
import { ID } from 'node-appwrite'
import { getBook } from '@/lib/appwrite/databases'
import { FUNCTIONS, APPWRITE_DATABASE_ID, COLLECTIONS } from '@/lib/appwrite/collections'
import { getAuthUser, createAdminClient } from '@/lib/appwrite/api-auth'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/books/[id]/export'>,
) {
  const { id } = await ctx.params
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const book = await getBook(id)
  if (!book || book.createdBy !== user.userId) {
    return Response.json({ error: 'Não encontrado' }, { status: 404 })
  }

  if (book.status !== 'exporting_pdf' && book.status !== 'assembling') {
    return Response.json(
      { error: `Livro não está pronto para exportação (status: ${book.status})` },
      { status: 409 },
    )
  }

  const { databases, functions } = createAdminClient()

  try {
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
