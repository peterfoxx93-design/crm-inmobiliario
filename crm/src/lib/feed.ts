/**
 * Agrupacion de la timeline de actividades por dia (Task 12).
 * Puro y testeable en node; el componente solo pinta.
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";

import type { ActivityRow } from "@/lib/types";

export interface ActivityDayGroup {
  /** Etiqueta del dia: Hoy / Ayer / "12 mar". */
  label: string;
  items: ActivityRow[];
}

function dayKey(dateIso: string): string {
  const date = new Date(dateIso);
  return format(date, "yyyy-MM-dd", { locale: es });
}

/**
 * Agrupa actividades en dias descendentes; dentro de cada dia se ordenan
 * por fecha descendente (recientes primero) sea cual sea el orden de entrada.
 */
export function groupActivitiesByDay(
  activities: readonly ActivityRow[],
  now: Date = new Date(),
): ActivityDayGroup[] {
  const todayKey = dayKey(now.toISOString());
  const yesterdayKey = dayKey(
    new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
  );

  const groups = new Map<string, ActivityRow[]>();
  for (const activity of activities) {
    const key = dayKey(activity.created_at);
    const bucket = groups.get(key);
    if (bucket) bucket.push(activity);
    else groups.set(key, [activity]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      label:
        key === todayKey
          ? "Hoy"
          : key === yesterdayKey
            ? "Ayer"
            : format(new Date(`${key}T12:00:00`), "d MMM yyyy", { locale: es }),
      items: [...items].sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      ),
    }));
}
