import { Account, Client } from 'node-appwrite'
import { type NextRequest } from 'next/server'

const SESSION_COOKIE = 'acadbook-session'

export async function GET(request: NextRequest) {
  // Ler cookie do request header diretamente
  const cookieHeader = request.headers.get('cookie') ?? ''
  let jwt: string | undefined

  if (cookieHeader) {
    const parsed = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=')
        return [k, v.join('=')]
      }),
    )
    jwt = parsed[SESSION_COOKIE]
  }

  if (!jwt) {
    return Response.json({ user: null, reason: 'no_cookie' }, { status: 401 })
  }

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt)

    const account = new Account(client)
    const user = await account.get()

    return Response.json({
      user: { $id: user.$id, name: user.name, email: user.email },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.log(`[auth/me] ERROR: ${message} | JWT: ${jwt?.substring(0, 20)}...`)
    return Response.json({ user: null, error: message }, { status: 401 })
  }
}
