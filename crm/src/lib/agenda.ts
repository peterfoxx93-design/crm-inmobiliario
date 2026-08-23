/**
 * Helpers puros de la Agenda (Task 14). Sin React ni Supabase para poder
 * testearlos en node; los tipos compartidos viven aqui para que los
 * componentes cliente no importen el modulo server-only de queries.
 *
 * Convencion de fechas: las claves de dia son LOCALES (`yyyy-MM-dd`, el mismo
 * espacio que el Calendar de react-day-picker), mientras que el rango de
 * consulta del mes se filtra en Postgres sobre `due_date` (timestamptz).
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { Activity } from "@/lib/types";

// --- Tipos compartidos servidor -> cliente ---

export interface TaskContactSummary {
  full_name: string;
}

export interface TaskPropertySummary {
  id: string;
  title: string;
}

/** Activity (type='tarea') enriquecida con contacto y propiedad embebidos. */
export interface TaskWithRelations extends Activity {
  contact: TaskContactSummary | null;
  property: TaskPropertySummary | null;
}

// --- Claves de dia ---

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clave local `yyyy-MM-dd` de un instante ISO; "" si no es parseable. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd", { locale: es });
}

/** Clave local del dia actual. */
export function todayKey(): string {
  return dayKey(new Date().toISOString());
}

/** Suma (o resta) dias sobre una CLAVE `yyyy-MM-dd`; "" si la clave es invalida. */
export function shiftDayKey(key: string, days: number): string {
  if (!DAY_KEY_RE.test(key)) return "";
  const [y, m, d] = key.split("-").map(Number);
  // Ancla al mediodia UTC: inmune a cambios de hora/DST al mover dias.
  const next = new Date(Date.UTC(y, m - 1, d + days, 12));
  return next.toISOString().slice(0, 10);
}

/** Suma (o resta) dias a un instante ISO preservando la hora; "" si es invalido. */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// --- Rangos de mes ---

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Rango de consulta del mes completo como fechas ISO `[from, to)`:
 * `from` = primer dia del mes, `to` = primer dia del siguiente.
 */
export function buildMonthRange(
  year: number,
  month: number,
): { from: string; to: string } {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Mes no válido.");
  }
  const toMonth = month === 12 ? 1 : month + 1;
  const toYear = month === 12 ? year + 1 : year;
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${toYear}-${pad2(toMonth)}-01`,
  };
}

/** Mes `YYYY-MM` contenido en una clave de dia; null si la clave es invalida. */
export function monthOfDayKey(key: string): string | null {
  if (!DAY_KEY_RE.test(key)) return null;
  return key.slice(0, 7);
}

// --- Agrupacion por dia ---

/**
 * Agrupa tareas por clave de dia LOCAL en un Map ordenado ascendente;
 * dentro de cada dia se ordenan cronologicamente por due_date.
 * Descarta defensivamente tareas sin due_date (la query ya las excluye).
 */
export function groupTasksByDay(
  tasks: readonly TaskWithRelations[],
): Map<string, TaskWithRelations[]> {
  const groups = new Map<string, TaskWithRelations[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = dayKey(task.due_date);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(task);
    else groups.set(key, [task]);
  }

  for (const [key, items] of groups) {
    groups.set(
      key,
      [...items].sort((a, b) =>
        a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0,
      ),
    );
  }

  return new Map([...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}
