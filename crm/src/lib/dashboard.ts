/**
 * Helpers puros del Dashboard (Task 15). Sin React ni Supabase para poder
 * testearlos en node; las queries server-only viven en lib/queries/stats.ts.
 *
 * Decisiones documentadas:
 * - Delta %: con base previa 0 y actual > 0 se devuelve `null` (matematicamente
 *   indefinido; la UI pinta un "—"" neutral en vez de inventar +infinito).
 * - Embudo: cuenta SOLO deals abiertos (`won IS NULL`), igual que el kanban
 *   del pipeline (Task 13); los ganados/perdidos congelan su etapa y falsearian
 *   el embudo.
 * - SLA de leads: un lead `nuevo` SIN actividad reciente usa su `created_at`
 *   como referencia (brecha cuando el propio alta supera el umbral), de modo
 *   que un lead creado hace minutos no salta como alerta de forma espuria.
 *   El set de "frescos" lo calcula el servidor con una query indexada.
 */

import { DEAL_STAGES } from "@/lib/constants";
import { dayKey } from "@/lib/agenda";
import type { AgencySettings, DealStage } from "@/lib/types";

// --- Delta porcentual ---

/**
 * Delta porcentual entre periodo actual y previo, redondeado a 1 decimal.
 * - previo 0 y actual 0 -> 0 (sin cambio).
 * - previo 0 y actual > 0 -> null (crecimiento desde base cero: indefinido).
 * - entradas negativas o no finitas -> null.
 */
export function percentDelta(current: number, previous: number): number | null {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    current < 0 ||
    previous < 0
  ) {
    return null;
  }
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** "+20%" / "-12,5%" / "0%"; null si el delta es null. Locale es-ES. */
export function formatDeltaPercent(delta: number | null): string | null {
  if (delta === null || !Number.isFinite(delta)) return null;
  const abs = Math.abs(delta);
  const text = abs % 1 === 0 ? String(abs) : abs.toFixed(1).replace(".", ",");
  if (delta > 0) return `+${text}%`;
  if (delta < 0) return `-${text}%`;
  return `${text}%`;
}

// --- Ventanas de comparacion 7d ---

export interface LeadWindows {
  /** ISO: inicio de la ventana actual (ahora - 7d). */
  currentFrom: string;
  /** ISO: inicio de la ventana previa (ahora - 14d). */
  previousFrom: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ventanas [previo | actual] para leads nuevos: actual = ultimos 7 dias,
 * previo = los 7 anteriores. Fecha invalida -> cae a `new Date()` para que
 * la pagina nunca reviente por un reloj raro (leccion T14).
 */
export function buildLeadWindows(now: Date = new Date()): LeadWindows {
  const base = Number.isNaN(now.getTime()) ? new Date() : now;
  return {
    currentFrom: new Date(base.getTime() - 7 * DAY_MS).toISOString(),
    previousFrom: new Date(base.getTime() - 14 * DAY_MS).toISOString(),
  };
}

// --- SLA de leads ---

const DEFAULT_SLA_HOURS = 24;

/** Horas de SLA configuradas; default 24 ante ausencia o valor invalido. */
export function slaHoursOrDefault(settings?: AgencySettings | null): number {
  const raw = settings?.sla_lead_hours;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_SLA_HOURS;
  }
  return raw;
}

/** Contact candidato a alerta SLA (status='nuevo' ya filtrado en la query). */
export interface SlaCandidateContact {
  id: string;
  full_name: string;
  created_at: string;
}

function safeTime(iso: string): number | null {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Leads `nuevo` que incumplen el SLA, via ANTI-JOIN eficiente: la query
 * servidor aporta el set de contact_ids con CUALQUIER actividad posterior
 * al corte (aprovecha idx_activities_contact); el resto breacha si su
 * propio created_at es anterior al corte (referencia del lead sin tocar).
 * Ordenados de mas antiguo a mas reciente.
 */
export function pickSlaBreaches(
  contacts: readonly SlaCandidateContact[],
  freshIds: ReadonlySet<string>,
  now: Date,
  slaHours: number,
): SlaCandidateContact[] {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(slaHours) || slaHours <= 0) {
    return [];
  }
  const cutoff = nowMs - slaHours * 60 * 60 * 1000;

  const breaches: Array<{ contact: SlaCandidateContact; ref: number }> = [];
  for (const contact of contacts) {
    if (freshIds.has(contact.id)) continue;
    const ref = safeTime(contact.created_at);
    if (ref !== null && ref < cutoff) {
      breaches.push({ contact, ref });
    }
  }

  return breaches
    .sort((a, b) => a.ref - b.ref)
    .map(({ contact }) => contact);
}

// --- Embudo y pipeline ---

export interface DealStageCount {
  stage: DealStage;
}

export interface FunnelBar {
  stage_id: DealStage;
  label: string;
  count: number;
}

/** Cuenta deals abiertos por etapa, rellenando todas las etapas del vocabulario. */
export function aggregateFunnel(rows: readonly DealStageCount[]): FunnelBar[] {
  const counts = new Map<DealStage, number>(DEAL_STAGES.map((s) => [s.id, 0]));
  for (const row of rows) {
    if (counts.has(row.stage)) {
      counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1);
    }
  }
  return DEAL_STAGES.map((stage) => ({
    stage_id: stage.id,
    label: stage.label,
    count: counts.get(stage.id) ?? 0,
  }));
}

/** Suma `value` de deals tratando null/invalidos como 0. */
export function sumDealValue(rows: readonly { value: number | null }[]): number {
  let total = 0;
  for (const row of rows) {
    if (typeof row.value === "number" && Number.isFinite(row.value)) {
      total += row.value;
    }
  }
  return total;
}

// --- Tareas de hoy / vencidas ---

/** Tarea minima que consume el panel (la query ya excluye completadas). */
export interface TodayTask {
  id: string;
  title: string;
  due_date: string | null;
  contact_name: string | null;
}

export interface TodaySplit {
  hoy: TodayTask[];
  vencidas: TodayTask[];
}

/**
 * Reparte tareas abiertas entre hoy y vencidas segun clave de dia LOCAL,
 * misma convencion que la agenda (Task 14):
 * - hoy: dayKey(due_date) === todayKeyStr;
 * - vencidas: due_date de un dia ANTERIOR a hoy (una tarea de hoy pendiente
 *   sigue siendo "de hoy" hasta que acabe el dia).
 * Futuras o sin fecha valida: fuera de ambos buckets. Orden cronologico asc.
 */
export function splitTodayOverdue(
  tasks: readonly TodayTask[],
  todayKeyStr: string,
): TodaySplit {
  const hoy: TodayTask[] = [];
  const vencidas: Array<{ task: TodayTask; key: string }> = [];

  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = dayKey(task.due_date);
    if (!key) continue;
    if (key === todayKeyStr) {
      hoy.push(task);
    } else if (key < todayKeyStr) {
      vencidas.push({ task, key });
    }
  }

  const byDueAsc = (a: TodayTask, b: TodayTask) =>
    (a.due_date ?? "") < (b.due_date ?? "")
      ? -1
      : (a.due_date ?? "") > (b.due_date ?? "")
        ? 1
        : 0;

  return {
    hoy: [...hoy].sort(byDueAsc),
    vencidas: vencidas
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(({ task }) => task),
  };
}
