/**
 * Estado de la vista Agenda en la URL (Task 14), mismo patron que
 * map-view.ts (Task 11): helpers puros sin React para compartir la vista
 * via querystring (`?vista=...&dia=...&mes=...`) y poder testearlos en node.
 */

export type AgendaViewType = "dia" | "mes";

export interface AgendaViewState {
  vista: AgendaViewType;
  /** Dia seleccionado `YYYY-MM-DD`; null = hoy. */
  dia: string | null;
  /** Mes visible `YYYY-MM`; null = mes del dia seleccionado o actual. */
  mes: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Comprueba que la clave sea un dia REAL del calendario mediante round-trip
 * UTC: si algun componente se sale de rango (`2026-02-30`, `2026-13-01`),
 * Date.UTC lo desborda al siguiente mes/anio y el round-trip no devuelve los
 * mismos numeros. Sin este guard, claves "con formato valido pero inexistentes"
 * llegaban a la pagina y `new Date()` / Intl lanzaban RangeError (Task 19).
 */
function isValidDayKey(key: string): boolean {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** Igual que `isValidDayKey` para claves `YYYY-MM` (`2026-13`, `2026-00`). */
function isValidMonthKey(key: string): boolean {
  const [year, month] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, 1, 12));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Lee y sanea los params crudos de la URL; cualquier valor raro -> default. */
export function parseAgendaView(
  params: Record<string, string | string[] | undefined>,
): AgendaViewState {
  const rawVista = firstParam(params.vista);
  const rawDia = firstParam(params.dia);
  const rawMes = firstParam(params.mes);

  return {
    vista: rawVista === "mes" ? "mes" : "dia",
    dia:
      rawDia && DAY_RE.test(rawDia) && isValidDayKey(rawDia) ? rawDia : null,
    mes:
      rawMes && MONTH_RE.test(rawMes) && isValidMonthKey(rawMes)
        ? rawMes
        : null,
  };
}

/**
 * Serializa el estado a querystring para la vista objetivo conservando la
 * fecha seleccionada (`dia`/`mes`). `dia` es el default y se omite, igual
 * que hace map-view con `lista`.
 */
export function viewToSearchParams(
  state: AgendaViewState,
  target: AgendaViewType,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.dia) sp.set("dia", state.dia);
  if (state.mes) sp.set("mes", state.mes);
  if (target === "mes") sp.set("vista", "mes");
  return sp;
}
