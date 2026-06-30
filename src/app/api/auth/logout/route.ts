import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acadbook-session'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  return Response.json({ success: true })
}
