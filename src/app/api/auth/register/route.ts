import { Account, Client, ID } from 'node-appwrite'
import { cookies } from 'next/headers'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(128).trim(),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(256),
})

const SESSION_COOKIE = 'acadbook-session'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { name, email, password } = parsed.data

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!)

    const account = new Account(client)

    // Criar conta
    const newUser = await account.create(ID.unique(), email, password, name)

    // Criar sessão
    const sessionClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)

    const sessionAccount = new Account(sessionClient)
    const session = await sessionAccount.createEmailPasswordSession(email, password)

    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return Response.json({
      user: { $id: newUser.$id, name: newUser.name, email: newUser.email },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('409') || message.includes('already exists')) {
      return Response.json({ error: 'Este email já está em uso.' }, { status: 409 })
    }
    return Response.json({ error: 'Falha no registro. Tente novamente.' }, { status: 500 })
  }
}
