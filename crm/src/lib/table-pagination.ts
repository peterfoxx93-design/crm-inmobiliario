/**
 * Utilidades puras de paginacion para DataTable (Task 8).
 * Sin dependencias de React para poder testearlas en entorno node.
 */

/** Rango de filas visibles, 1-indexado e inclusivo. */
export interface RowRange {
  from: number;
  to: number;
}

function sanitizeInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.floor(value);
}

/**
 * Calcula el rango "Mostrando X-Y de Z" del pie de una tabla paginada.
 * Satura `pageIndex` a la ultima pagina valida y tolera entradas invalidas.
 */
export function getRowRange(
  pageIndex: number,
  pageSize: number,
  totalRows: number,
): RowRange {
  const total = Math.max(0, sanitizeInt(totalRows, 0));
  if (total === 0) return { from: 0, to: 0 };

  const size = Math.max(1, sanitizeInt(pageSize, 10));
  const pageCount = Math.ceil(total / size);
  const page = Math.min(Math.max(0, sanitizeInt(pageIndex, 0)), pageCount - 1);

  return {
    from: page * size + 1,
    to: Math.min((page + 1) * size, total),
  };
}
