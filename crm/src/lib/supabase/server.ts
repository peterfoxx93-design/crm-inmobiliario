import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * Cliente Supabase para Server Components, Route Handlers y Server Actions.
 * Lee/escribe las cookies de sesión con el patrón oficial getAll/setAll.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: "pkce" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no se puede escribir cookies.
            // Es seguro ignorarlo si el middleware refresca las sesiones.
          }
        },
      },
    },
  );
}

/**
 * Devuelve el usuario autenticado o `null`.
 * `getUser()` valida el JWT contra el servidor de Auth (no confía solo
 * en la cookie), por eso se prefiere sobre `getSession()`.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
