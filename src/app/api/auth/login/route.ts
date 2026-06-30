import { Account, Client, Users } from 'node-appwrite'
import { cookies } from 'next/headers'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

const SESSION_COOKIE = 'acadbook-session'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const { email, password } = parsed.data

  try {
    // 1. Criar sessão para validar credenciais e obter userId
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)

    const account = new Account(client)
    const session = await account.createEmailPasswordSession(email, password)

    // 2. Usar admin client para criar um JWT para o usuário
    const adminClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!)

    const users = new Users(adminClient)
    const jwtResponse = await users.createJWT(session.userId)
    const jwt = jwtResponse.jwt

    // 3. Buscar dados do usuário
    const user = await users.get(session.userId)

    // 4. Guardar JWT no cookie httpOnly
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    })

    return Response.json({
      user: { $id: user.$id, name: user.name, email: user.email },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('401') || message.includes('Invalid credentials')) {
      return Response.json({ error: 'Email ou senha incorretos' }, { status: 401 })
    }
    return Response.json({ error: 'Falha no login. Tente novamente.' }, { status: 500 })
  }
}
