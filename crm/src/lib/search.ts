/**
 * Sanitiza el termino de busqueda para usarlo en filtros `.or()` de PostgREST
 * con patrones `ilike`:
 *
 * - `,` separa condiciones en el parser de PostgREST (una coma suelta rompe la
 *   query y la busqueda falla en silencio); `(`, `)` y `"` agrupan o citan
 *   valores y tambien son reservados del parser.
 * - `%` y `_` son comodines de LIKE (cualquier cadena / un caracter).
 *
 * Todos ellos se sustituyen por un espacio y se recortan los extremos.
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%,()"_]/g, " ").trim();
}
