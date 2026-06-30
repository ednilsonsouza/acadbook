import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { Account, Client, Databases, Functions, Users } from 'node-appwrite'

const SESSION_COOKIE = 'acadbook-session'

export interface AuthResult {
  userId: string
  email: string
  name: string
  jwt: string
}

/**
 * Lê o JWT do cookie usando cookies() do next/headers ( oficial Next.js 16 )
 * com fallback para request.headers.
 */
async function readJwt(request?: NextRequest): Promise<string | null> {
  // Método 1: cookies() do next/headers (oficial)
  try {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(SESSION_COOKIE)
    if (cookie?.value) return cookie.value
  } catch {
    // ignore — tenta fallback
  }

  // Método 2: request.headers (fallback)
  if (request) {
    const cookieHeader = request.headers.get('cookie') ?? ''
    if (cookieHeader) {
      const parsed = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=')
          return [k, v.join('=')]
        }),
      )
      if (parsed[SESSION_COOKIE]) return parsed[SESSION_COOKIE]
    }
  }

  return null
}

/**
 * Extrai e valida o JWT do cookie da requisição.
 * Retorna null se nao houver sessao valida.
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthResult | null> {
  const jwt = await readJwt(request)
  if (!jwt) return null

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt)

    const account = new Account(client)
    const user = await account.get()
    return {
      userId: user.$id,
      email: user.email,
      name: user.name,
      jwt,
    }
  } catch {
    return null
  }
}

/**
 * Helper para criar um admin client com API Key.
 */
export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!)

  return {
    client,
    databases: new Databases(client),
    functions: new Functions(client),
    users: new Users(client),
  }
}
