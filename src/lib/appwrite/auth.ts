'use server'

import { cookies } from 'next/headers'
import { Account, Client } from 'node-appwrite'

const SESSION_COOKIE = 'acadbook-session'

/**
 * Obtém a sessão do usuário a partir do cookie.
 * Retorna null se não houver sessão válida.
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE)
  if (!sessionCookie) return null

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setSession(sessionCookie.value)

    const account = new Account(client)
    const user = await account.get()
    return { user, sessionToken: sessionCookie.value, client }
  } catch {
    return null
  }
}

/**
 * Define o cookie de sessão após login bem-sucedido.
 */
export async function setSessionCookie(sessionToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  })
}

/**
 * Remove o cookie de sessão no logout.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export { SESSION_COOKIE }
