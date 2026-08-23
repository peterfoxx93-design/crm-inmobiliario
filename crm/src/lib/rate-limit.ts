/**
 * Rate limiter en memoria con ventana deslizante para el endpoint publico
 * de captacion de leads (Task 18).
 *
 * Diseno:
 * - Puro e inyectable de reloj (`now`), para poder testear ventana, limite
 *   exacto y reset sin esperas reales.
 * - Ventana deslizante por marca temporal (no ventanas fijas): evita el
 *   "burst" doble en el borde de dos ventanas consecutivas.
 * - Eviction acotada (review B1): cuando el mapa alcanza `evictionCap`
 *   claves se barren las entradas caducadas y, si aun falta sitio, se expulsa
 *   la menos recientemente activa. Invariante tras cada check:
 *   hits.size <= evictionCap => la memoria NO crece sin limite aunque un
 *   atacante genere infinitas claves distintas.
 * - Estado por proceso del servidor. Limitacion aceptada para 5 req/min/IP:
 *   con varias instancias detras de un balanceador cada una llevaria su
 *   propia ventana (si eso pasa, migrar a un store compartido tipo Redis).
 */

/** Configuracion por defecto del endpoint publico: 5 peticiones / minuto / IP. */
export const DEFAULT_LEAD_RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const;

/** Tope de claves rastreadas por proceso antes de disparar la eviction. */
const DEFAULT_EVICTION_CAP = 10_000;

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
  /** Tope de claves en el mapa antes de hacer eviction (tests). */
  evictionCap?: number;
}

export interface SlidingWindowLimiter {
  check(key: string): RateLimitResult;
  /** Claves actualmente rastreadas (observabilidad/tests). */
  size(): number;
}

export function createSlidingWindowLimiter(
  options: SlidingWindowLimiterOptions,
): SlidingWindowLimiter {
  const { limit, windowMs } = options;
  const evictionCap = options.evictionCap ?? DEFAULT_EVICTION_CAP;
  const nowFn = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function evictIfNeeded(windowStart: number): void {
    if (hits.size < evictionCap) return;

    // Fase 1: barrido barato de claves cuya ultima marca ya caduco.
    for (const [key, marks] of hits) {
      if ((marks[marks.length - 1] ?? 0) <= windowStart) {
        hits.delete(key);
      }
    }

    // Fase 2: cota dura. Si siguen llenandose las claves vivas (flood de
    // IPs distintas dentro de la ventana), expulsa la menos recientemente
    // activa hasta dejar hueco para la clave entrante.
    while (hits.size >= evictionCap) {
      let oldestKey: string | null = null;
      let oldestMark = Infinity;
      for (const [key, marks] of hits) {
        const newest = marks[marks.length - 1] ?? 0;
        if (newest < oldestMark) {
          oldestMark = newest;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      hits.delete(oldestKey);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = nowFn();
      const windowStart = now - windowMs;
      // Poda: solo cuentan las marcas dentro de la ventana deslizante.
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

      if (recent.length >= limit) {
        evictIfNeeded(windowStart);
        hits.set(key, recent);
        const oldest = Math.min(...recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000),
        };
      }

      evictIfNeeded(windowStart);
      recent.push(now);
      hits.set(key, recent);
      return {
        allowed: true,
        remaining: limit - recent.length,
        retryAfterSeconds: 0,
      };
    },

    size(): number {
      return hits.size;
    },
  };
}

/**
 * Extrae la IP del cliente desde las cabeceras del request.
 *
 * OJO (review R1): en x-forwarded-for cada proxy ANADE su entrada al final;
 * la entrada mas a la DERECHA es la observada por nuestro propio proxy
 * (autoridad). La IZQUIERDA la controla el cliente y es spoofable: usarla
 * como clave permiteria fabricar claves ilimitadas contra el limiter.
 * `x-real-ip` como fallback. Sin proxy devuelve cadena vacia y el llamante
 * decide la clave neutra.
 */
export function extractClientIp(
  getHeader: (name: string) => string | null,
): string {
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim());
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i]) return parts[i] as string;
    }
  }
  const real = getHeader("x-real-ip")?.trim();
  return real || "";
}
