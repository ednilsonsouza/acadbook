import { Account, Client } from 'node-appwrite'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acadbook-session'

export async function GET(request: Request) {
  // Tentar ler o cookie do header diretamente
  const cookieHeader = request.headers.get('cookie') ?? ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  const jwt = cookies[SESSION_COOKIE]

  console.log(`[auth/me] cookie header: ${!!cookieHeader}, jwt found: ${!!jwt}, length: ${jwt?.length}`)

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
