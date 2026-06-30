import { Account, Client } from 'node-appwrite'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acadbook-session'

import { Account, Client } from 'node-appwrite'
import { cookies, headers } from 'next/headers'
import { type NextRequest } from 'next/server'

const SESSION_COOKIE = 'acadbook-session'

export async function GET(request: NextRequest) {
  // Tentar TODAS as formas de ler o cookie
  const cookieHeader = request.headers.get('cookie') ?? ''
  const allHeaders = Object.fromEntries(request.headers.entries())
  const headerKeys = Object.keys(allHeaders).join(',')

  console.log(`[auth/me] cookieHeader len: ${cookieHeader.length}, all header keys: ${headerKeys}`)

  let jwt: string | undefined

  // 1. Tentar do request headers
  if (cookieHeader) {
    const parsed = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=')
        return [k, v.join('=')]
      }),
    )
    jwt = parsed[SESSION_COOKIE]
  }

  // 2. Tentar do cookies() do Next.js
  if (!jwt) {
    try {
      const cookieStore = await cookies()
      jwt = cookieStore.get(SESSION_COOKIE)?.value
    } catch (e) {
      console.log(`[auth/me] cookies() error: ${e}`)
    }
  }

  // 3. Tentar do headers() do Next.js
  if (!jwt) {
    try {
      const h = await headers()
      const cookieFromHeaders = h.get('cookie')
      if (cookieFromHeaders) {
        const parsed = Object.fromEntries(
          cookieFromHeaders.split(';').map((c) => {
            const [k, ...v] = c.trim().split('=')
            return [k, v.join('=')]
          }),
        )
        jwt = parsed[SESSION_COOKIE]
      }
    } catch (e) {
      console.log(`[auth/me] headers() error: ${e}`)
    }
  }

  console.log(`[auth/me] jwt found: ${!!jwt}, length: ${jwt?.length}`)

  if (!jwt) {
    return Response.json({
      user: null,
      reason: 'no_cookie',
      debug: { cookieHeaderLen: cookieHeader.length, headerKeys }
    }, { status: 401 })
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
