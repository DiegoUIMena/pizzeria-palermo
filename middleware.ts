import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // No necesitamos redirigir ya que la página principal debe estar en la raíz
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Solo activamos el middleware en rutas específicas si es necesario
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
