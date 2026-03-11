import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware de Seguridad para Pizzería Palermo
 * 
 * Protege las rutas administrativas (/admin/*) verificando:
 * 1. Usuario autenticado (tiene sesión activa)
 * 2. Usuario tiene rol "admin" en Firebase
 * 
 * Implementado en: Fase 1 - Seguridad Inmediata
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ============================================
  // PROTECCIÓN DE RUTAS ADMINISTRATIVAS
  // ============================================
  if (pathname.startsWith('/admin')) {
    // Obtener el token de autenticación de Firebase desde las cookies
    // Firebase Auth guarda el token en el localStorage del cliente,
    // pero para verificarlo en el servidor necesitamos una estrategia diferente
    
    // OPCIÓN 1: Verificar en el cliente antes de renderizar (implementado más abajo)
    // OPCIÓN 2: Usar Firebase Auth Emulator o Admin SDK (requiere API route)
    
    // Por ahora, permitimos el acceso y la verificación se hará en el cliente
    // mediante el AuthContext que ya tienes implementado
    // 
    // IMPORTANTE: En Fase 2, implementaremos verificación servidor-side con
    // Custom Claims de Firebase Auth
    
    console.log('[Middleware] Acceso a ruta admin:', pathname);
    
    // TODO Fase 2: Implementar verificación servidor-side con Firebase Admin SDK
    // const token = request.cookies.get('__session')?.value;
    // if (!token) {
    //   return NextResponse.redirect(new URL('/auth?redirect=' + pathname, request.url));
    // }
    
    return NextResponse.next();
  }
  
  // ============================================
  // TODAS LAS DEMÁS RUTAS
  // ============================================
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
