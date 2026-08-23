/**
 * Utilidades de formato (locale es-ES) y helpers de referencia/SLA.
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";

const DAY_MS = 24 * 60 * 60 * 1000;

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** Formatea un importe en EUR con locale es-ES (ej. 250000 -> "250.000,00 EUR-symbol"). */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** Formatea una fecha (Date o ISO string) como "dd MMM yyyy" en espanol. */
export function formatDate(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return format(parsed, "dd MMM yyyy", { locale: es });
}

/** Construye la referencia publica de una propiedad: REF-0001, REF-0042... */
export function buildReference(seq: number): string {
  return `REF-${String(seq).padStart(4, "0")}`;
}

/**
 * true si han pasado mas de `limitDays` dias desde `stageUpdatedAt` hasta ahora
 * (alerta SLA del pipeline).
 */
export function isStageOverdue(
  stageUpdatedAt: Date | string,
  limitDays: number,
): boolean {
  const updated =
    typeof stageUpdatedAt === "string" ? new Date(stageUpdatedAt) : stageUpdatedAt;
  const elapsedDays = (Date.now() - updated.getTime()) / DAY_MS;
  return elapsedDays > limitDays;
}
