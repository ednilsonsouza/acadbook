import { type NextRequest } from 'next/server'
import { Account, Client, Databases, Functions, Users } from 'node-appwrite'

const SESSION_COOKIE = 'acadbook-session'

export interface AuthResult {
  userId: string
  email: string
  name: string
  jwt: string
}

function readJwtFromRequest(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie') ?? ''
  if (!cookieHeader) return null

  const parsed = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  return parsed[SESSION_COOKIE] ?? null
}

/**
 * Extrai e valida o JWT do cookie da requisição.
 * Retorna null se nao houver sessao valida.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult | null> {
  const jwt = readJwtFromRequest(request)
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
 * Retorna instancias separadas de Databases, Functions e Users.
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
