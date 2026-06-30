import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'
import { createBookSchema } from '@/lib/validation/book-schema'
import { createBook, listBooksByUser } from '@/lib/appwrite/databases'

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
    const account = new Account(client)
    return await account.get()
  } catch {
    return null
  }
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const books = await listBooksByUser(user.$id)
    return Response.json({ books })
  } catch {
    return Response.json({ error: 'Falha ao listar livros' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser()
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
    const book = await createBook(parsed.data, user.$id)
    return Response.json({ book }, { status: 201 })
  } catch {
    return Response.json({ error: 'Falha ao criar livro' }, { status: 500 })
  }
}
