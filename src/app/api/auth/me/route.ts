import { Account, Client } from 'node-appwrite'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acadbook-session'

export async function GET() {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(SESSION_COOKIE)?.value

  if (!jwt) {
    return Response.json({ user: null }, { status: 401 })
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
    const stack = err instanceof Error ? err.stack?.substring(0, 500) : ''
    console.log(`[auth/me] ERROR: ${message} | JWT: ${jwt?.substring(0, 20)}... | STACK: ${stack}`)
    const cookieStore2 = await cookies()
    cookieStore2.delete(SESSION_COOKIE)
    return Response.json({ user: null, error: message }, { status: 401 })
  }
}
