/**
 * Utilidades de autenticación compartidas (servidor y cliente).
 * Mantener libre de dependencias de React para poder testearla en node.
 */

/** Clave de localStorage donde se recuerda el slug de la agencia (brief Task 5). */
export const AGENCY_SLUG_STORAGE_KEY = "agency_slug";

/**
 * O1 (enmienda controller): valida el parámetro `next` contra open-redirect.
 * Solo se aceptan rutas internas que empiecen por "/" y NO empiecen por "//"
 * (ni "\\", ni esquemas absolutos como https: o javascript:).
 * Si no pasa la validación se devuelve "/", nunca el valor original.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

/** Destino por defecto tras iniciar sesión (brief Task 5, Step 3). */
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

/**
 * Resuelve el destino post-login combinando el brief con la enmienda O1:
 * - sin `next` -> /dashboard (brief);
 * - `next` inválido (open-redirect) -> "/" (O1);
 * - `next` válido -> se respeta tal cual.
 */
export function resolvePostLoginPath(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") {
    return DEFAULT_LOGIN_REDIRECT;
  }
  return sanitizeNextPath(raw);
}
