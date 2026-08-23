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

/** Formateo compacto para cabeceras de columna del pipeline ("1,2 M €"). */
const compactCurrencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Importe compacto en EUR (ej. 1200000 -> "1,2 M €"). */
export function formatCompactEur(value: number): string {
  return compactCurrencyFormatter.format(value);
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

const REFERENCE_PATTERN = /^REF-(\d+)$/;

/**
 * Extrae la secuencia numerica de una referencia ("REF-0042" -> 42).
 * Devuelve null si el formato no encaja; la usa createProperty para
 * calcular la siguiente referencia a partir de max(reference).
 */
export function parseReferenceSeq(reference: string): number | null {
  const match = REFERENCE_PATTERN.exec(reference.trim());
  return match ? Number.parseInt(match[1], 10) : null;
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

/**
 * Dias completos que el deal lleva en su etapa actual (contador del pipeline).
 * Fecha futura, invalida o ausente -> 0 (nunca negativo).
 */
export function daysInStage(
  stageUpdatedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!stageUpdatedAt) return 0;
  const updated =
    typeof stageUpdatedAt === "string" ? new Date(stageUpdatedAt) : stageUpdatedAt;
  const elapsedMs = now.getTime() - updated.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / DAY_MS);
}

const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_S = 24 * HOUR_S;

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/**
 * Tiempo relativo en espanol para la columna "ultima actividad"
 * ("hace 5 minutos", "hace 3 horas", "hace 2 dias"; a partir de 30 dias
 * cae a fecha corta via formatDate).
 */
export function formatRelativeTime(
  dateIso: Date | string,
  now: Date = new Date(),
): string {
  const date = typeof dateIso === "string" ? new Date(dateIso) : dateIso;
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds >= 30 * DAY_S) return formatDate(date);
  if (absSeconds < MINUTE_S) return rtf.format(Math.round(diffSeconds), "second");
  if (absSeconds < HOUR_S)
    return rtf.format(Math.round(diffSeconds / MINUTE_S), "minute");
  if (absSeconds < DAY_S)
    return rtf.format(Math.round(diffSeconds / HOUR_S), "hour");
  return rtf.format(Math.round(diffSeconds / DAY_S), "day");
}
