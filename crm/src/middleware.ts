import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Guard global de sesión: refresca el token en cada request y redirige a
 * /login si no hay usuario. Las rutas públicas están excluidas en `matcher`
 * (ver config al final); todo lo demás requiere sesión.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Protege todo excepto:
     * - /login, /auth/* (callback de código) y /form/* (formularios públicos)
     * - /api/public/* (webhooks/endpoints anónimos)
     * - assets estáticos de Next (_next/static, _next/image), favicon e imágenes
     */
    "/((?!login(?:$|/)|auth/|form/|api/public/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
