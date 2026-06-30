import { Account, Client } from 'node-appwrite'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acadbook-session'

export async function POST() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value

  if (sessionToken) {
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
        .setSession(sessionToken)

      const account = new Account(client)
      await account.deleteSession('current')
    } catch {
      // Sessão pode já ter expirado — silencioso
    }
  }

  cookieStore.delete(SESSION_COOKIE)
  return Response.json({ success: true })
}
