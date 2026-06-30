import { type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/appwrite/api-auth'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)

  if (!user) {
    return Response.json({ user: null }, { status: 401 })
  }

  return Response.json({
    user: { $id: user.userId, name: user.name, email: user.email },
  })
}
