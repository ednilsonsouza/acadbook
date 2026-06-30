import { type NextRequest } from 'next/server'
import { createBookSchema } from '@/lib/validation/book-schema'
import { createBook, listBooksByUser } from '@/lib/appwrite/databases'
import { getAuthUser } from '@/lib/appwrite/api-auth'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const books = await listBooksByUser(user.userId)
    return Response.json({ books })
  } catch {
    return Response.json({ error: 'Falha ao listar livros' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const parsed = createBookSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  try {
    const book = await createBook(parsed.data, user.userId)
    return Response.json({ book }, { status: 201 })
  } catch {
    return Response.json({ error: 'Falha ao criar livro' }, { status: 500 })
  }
}
