/**
 * Slug automatico para agencias (Task 17).
 * Funcion pura libre de React/Next/Supabase para poder testearla en node.
 * Convencion REF-style del proyecto: minusculas ASCII, separador "-",
 * sin guiones sobrantes; cadena vacia si no queda nada util.
 */

/** Longitud maxima del slug de agencia (coincide con agencySlugSchema). */
export const SLUG_MAX_LENGTH = 60;

/**
 * Normaliza un nombre de agencia a slug URL-safe:
 * - minusculas y recorte de espacios;
 * - acentos/diacriticos fuera (NFD) y ene -> n;
 * - todo lo que no sea letra o numero se convierte en separador "-";
 * - colapso de separadores contiguos y recorte en extremos;
 * - limite de 60 caracteres sin dejar guion final.
 */
export function slugify(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gu, "n")
    .replace(/[^a-z0-9]+/g, "-");

  const collapsed = base.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!collapsed) return "";

  const trimmed = collapsed.slice(0, SLUG_MAX_LENGTH);
  return trimmed.replace(/-$/g, "");
}
