import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import { resolvePostLoginPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión · CRM Inmobiliario",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Página de login (pre-auth, pública).
 * - `?agencia=slug` fija la agencia; si falta se pide y se recuerda en
 *   localStorage (`agency_slug`) para visitas siguientes.
 * - `?next=` destino post-login: se resuelve en el servidor (O1 contra
 *   open-redirect; por defecto /dashboard) antes de pasarlo al formulario.
 * - `?error=auth` lo devuelve /auth/callback cuando el enlace ha caducado.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const agencia = firstParam(params.agencia)?.trim() || null;
  const nextPath = resolvePostLoginPath(firstParam(params.next));
  const authError = firstParam(params.error) === "auth";

  return (
    <LoginForm initialSlug={agencia} nextPath={nextPath} authError={authError} />
  );
}
