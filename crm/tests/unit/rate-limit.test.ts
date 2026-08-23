import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEAD_RATE_LIMIT,
  createSlidingWindowLimiter,
  extractClientIp,
} from "@/lib/rate-limit";

describe("createSlidingWindowLimiter", () => {
  it("usa el limite por defecto del endpoint publico (5 req / 60 s)", () => {
    expect(DEFAULT_LEAD_RATE_LIMIT).toEqual({ limit: 5, windowMs: 60_000 });
  });

  it("permite hasta `limit` peticiones seguidas y bloquea la siguiente", () => {
    const now = 1_000;
    const limiter = createSlidingWindowLimiter({
      limit: 3,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(true);

    const denied = limiter.check("ip-a");
    expect(denied.allowed).toBe(false);
    // La ventana expira a los 61.000 ms -> retry tras ~60 s.
    expect(denied.retryAfterSeconds).toBe(60);
  });

  it("es ventana deslizante: libera peticiones conforme caducan las antiguas", () => {
    let now = 1_000;
    const limiter = createSlidingWindowLimiter({
      limit: 2,
      windowMs: 10_000,
      now: () => now,
    });

    limiter.check("ip-b"); // t=1000
    limiter.check("ip-b"); // t=1000
    expect(limiter.check("ip-b").allowed).toBe(false);

    now += 5_000; // dentro de la ventana: sigue bloqueado
    expect(limiter.check("ip-b").allowed).toBe(false);

    now += 5_001; // la primera marca (t=1000) ya salio de la ventana
    const recovered = limiter.check("ip-b");
    expect(recovered.allowed).toBe(true);

    // La segunda marca (t=1000) tambien ha caducado: caben 2 mas.
    now += 1;
    expect(limiter.check("ip-b").allowed).toBe(true);
    expect(limiter.check("ip-b").allowed).toBe(false);
  });

  it("calcula retryAfterSeconds redondeando hacia arriba", () => {
    let now = 0;
    const limiter = createSlidingWindowLimiter({
      limit: 1,
      windowMs: 10_000,
      now: () => now,
    });

    limiter.check("ip-c");
    now = 500; // quedan 9.500 ms
    expect(limiter.check("ip-c")).toMatchObject({
      allowed: false,
      retryAfterSeconds: 10,
    });
    now = 900; // quedan 9.100 ms -> sigue siendo 10 s
    expect(limiter.check("ip-c").retryAfterSeconds).toBe(10);
    now = 901; // quedan 9.099 ms -> 10 s (ceil de 9,099)
    expect(limiter.check("ip-c").retryAfterSeconds).toBe(10);
  });

  it("aisla las claves: cada IP tiene su propia ventana", () => {
    const now = 0;
    const limiter = createSlidingWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.check("1.2.3.4").allowed).toBe(true);
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
    expect(limiter.check("5.6.7.8").allowed).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("extrae la primera IP de x-forwarded-for", () => {
    const get = (name: string) =>
      name === "x-forwarded-for" ? "203.0.113.7, 70.41.3.18" : null;
    expect(extractClientIp(get)).toBe("203.0.113.7");
  });

  it("recorta espacios alrededor de la IP", () => {
    const get = (name: string) =>
      name === "x-forwarded-for" ? "  198.51.100.2 " : null;
    expect(extractClientIp(get)).toBe("198.51.100.2");
  });

  it("usa x-real-ip como fallback", () => {
    const get = (name: string) =>
      name === "x-real-ip" ? "192.0.2.9" : null;
    expect(extractClientIp(get)).toBe("192.0.2.9");
  });

  it("devuelve un valor neutro si no hay cabeceras de proxy", () => {
    expect(extractClientIp(() => null)).toBe("");
    expect(extractClientIp((name) => (name === "x-forwarded-for" ? "" : null))).toBe("");
  });
});
