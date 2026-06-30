import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'acadbook-session'

// Rotas que exigem autenticação
const PROTECTED_PREFIXES = ['/books']

// Rotas públicas de auth (redirecionar para /books se já autenticado)
const AUTH_ROUTES = ['/login', '/register']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route)

  // Rota protegida sem sessão → redirecionar para login
  if (isProtected && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Já autenticado e tentando acessar login/register → redirecionar para dashboard
  if (isAuthRoute && sessionToken) {
    return NextResponse.redirect(new URL('/books', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
