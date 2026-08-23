import { NextResponse, type NextRequest } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Callback de auth (enlace mágico / confirmación): intercambia el `code`
 * PKCE por una sesión y redirige al destino validado con O1.
 * Esta ruta es pública: está excluida del matcher de src/middleware.ts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // O1: nunca confiar en `next` sin validar contra open-redirect
  // (sin `next` -> /dashboard; inválido -> "/").
  const next = resolvePostLoginPath(searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Sin código, código inválido o error del exchange: volver a /login.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
