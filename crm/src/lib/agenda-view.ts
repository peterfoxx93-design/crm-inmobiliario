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
    dia: rawDia && DAY_RE.test(rawDia) ? rawDia : null,
    mes: rawMes && MONTH_RE.test(rawMes) ? rawMes : null,
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
