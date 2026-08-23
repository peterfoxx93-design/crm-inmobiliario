/**
 * Rate limiter en memoria con ventana deslizante para el endpoint publico
 * de captacion de leads (Task 18).
 *
 * Diseno:
 * - Puro e inyectable de reloj (`now`), para poder testear ventana, limite
 *   exacto y reset sin esperas reales.
 * - Ventana deslizante por marca temporal (no ventanas fijas): evita el
 *   "burst" doble en el borde de dos ventanas consecutivas.
 * - Estado por proceso del servidor. Limitacion aceptada para 5 req/min/IP:
 *   con varias instancias detras de un balanceador cada una llevaria su
 *   propia ventana (si eso pasa, migrar a un store compartido tipo Redis).
 */

/** Configuracion por defecto del endpoint publico: 5 peticiones / minuto / IP. */
export const DEFAULT_LEAD_RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const;

export interface RateLimitResult {
  allowed: boolean;
  /** Peticiones que aun caben en la ventana actual. */
  remaining: number;
  /** Segundos (redondeo hacia arriba) hasta que caduca la marca mas antigua. */
  retryAfterSeconds: number;
}

export interface SlidingWindowLimiterOptions {
  limit: number;
  windowMs: number;
  /** Reloj inyectable (tests); por defecto Date.now. */
  now?: () => number;
}

export interface SlidingWindowLimiter {
  check(key: string): RateLimitResult;
}

export function createSlidingWindowLimiter(
  options: SlidingWindowLimiterOptions,
): SlidingWindowLimiter {
  const { limit, windowMs } = options;
  const nowFn = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const now = nowFn();
      const windowStart = now - windowMs;
      // Poda: solo cuentan las marcas dentro de la ventana deslizante.
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

      if (recent.length >= limit) {
        const oldest = Math.min(...recent);
        hits.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
        };
      }

      recent.push(now);
      hits.set(key, recent);
      return {
        allowed: true,
        remaining: limit - recent.length,
        retryAfterSeconds: 0,
      };
    },
  };
}

/**
 * Extrae la IP del cliente desde las cabeceras del request. Detras de un
 * proxy/CDN la IP real viaja en `x-forwarded-for` (primera posicion de la
 * lista); `x-real-ip` como fallback. Sin proxy devuelve cadena vacia y el
 * llamante decide la clave neutra.
 */
export function extractClientIp(
  getHeader: (name: string) => string | null,
): string {
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = getHeader("x-real-ip")?.trim();
  return real || "";
}
