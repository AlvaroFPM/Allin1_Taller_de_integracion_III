import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/perfil', '/publicar', '/mis-publicaciones'];
const authRoutes = ['/login', '/registro'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authRoutes.some((route) => pathname.startsWith(route)) && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/perfil/:path*',
    '/publicar/:path*',
    '/mis-publicaciones/:path*',
    '/login',
    '/registro',
  ],
};