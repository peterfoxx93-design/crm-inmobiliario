import { describe, expect, it } from "vitest";

import {
  aggregateFunnel,
  buildLeadWindows,
  formatDeltaPercent,
  percentDelta,
  pickSlaBreaches,
  slaHoursOrDefault,
  splitTodayOverdue,
  sumDealValue,
  type DealStageCount,
  type SlaCandidateContact,
  type TodayTask,
} from "@/lib/dashboard";

describe("percentDelta", () => {
  it("calcula el incremento porcentual basico", () => {
    expect(percentDelta(300, 250)).toBe(20);
    expect(percentDelta(150, 100)).toBe(50);
  });

  it("calcula descensos como valor negativo", () => {
    expect(percentDelta(50, 100)).toBe(-50);
  });

  it("devuelve 0 cuando ambos periodos son iguales", () => {
    expect(percentDelta(120, 120)).toBe(0);
  });

  it("redondea a 1 decimal", () => {
    expect(percentDelta(4, 3)).toBeCloseTo(33.3, 1);
    expect(percentDelta(2, 3)).toBeCloseTo(-33.3, 1);
  });

  it("con base previa 0: 0->0 es 0 y 0->N es null (sin base comparable)", () => {
    expect(percentDelta(0, 0)).toBe(0);
    expect(percentDelta(5, 0)).toBeNull();
  });

  it("rechaza entradas negativas o no finitas", () => {
    expect(percentDelta(-1, 10)).toBeNull();
    expect(percentDelta(10, -1)).toBeNull();
    expect(percentDelta(Number.NaN, 1)).toBeNull();
    expect(percentDelta(1, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("formatDeltaPercent", () => {
  it("anade signo + a los positivos", () => {
    expect(formatDeltaPercent(20)).toBe("+20%");
    expect(formatDeltaPercent(33.3)).toBe("+33,3%");
  });

  it("mantiene el signo negativo con decimales espanoles", () => {
    expect(formatDeltaPercent(-12.5)).toBe("-12,5%");
  });

  it("formatea el cero sin signo", () => {
    expect(formatDeltaPercent(0)).toBe("0%");
  });

  it("devuelve null para deltas nulos", () => {
    expect(formatDeltaPercent(null)).toBeNull();
  });
});

describe("buildLeadWindows", () => {
  // Ancla fija: 2026-08-23T12:00:00Z (mediodia UTC, inmune a DST).
  const NOW = new Date("2026-08-23T12:00:00Z");
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("ventana actual = ultimos 7 dias hasta ahora", () => {
    const w = buildLeadWindows(NOW);
    expect(w.currentFrom).toBe(new Date(NOW.getTime() - 7 * DAY_MS).toISOString());
    expect(w.previousFrom).toBe(
      new Date(NOW.getTime() - 14 * DAY_MS).toISOString(),
    );
  });

  it("cae a ahora si recibe una fecha invalida (nunca RangeError)", () => {
    const invalid = new Date("no-es-una-fecha") as unknown as Date;
    const w = buildLeadWindows(invalid);
    expect(Number.isNaN(new Date(w.currentFrom).getTime())).toBe(false);
    expect(Number.isNaN(new Date(w.previousFrom).getTime())).toBe(false);
  });
});

describe("slaHoursOrDefault", () => {
  it("usa el valor configurado cuando es valido", () => {
    expect(slaHoursOrDefault({ sla_lead_hours: 12 })).toBe(12);
    expect(slaHoursOrDefault({ sla_lead_hours: 48.5 })).toBe(48.5);
  });

  it("default 24 si no hay settings o la clave falta", () => {
    expect(slaHoursOrDefault(undefined)).toBe(24);
    expect(slaHoursOrDefault({})).toBe(24);
  });

  it("default 24 ante valores invalidos (0, negativos, NaN, texto)", () => {
    expect(slaHoursOrDefault({ sla_lead_hours: 0 })).toBe(24);
    expect(slaHoursOrDefault({ sla_lead_hours: -3 })).toBe(24);
    expect(slaHoursOrDefault({ sla_lead_hours: Number.NaN })).toBe(24);
    expect(slaHoursOrDefault({ sla_lead_hours: "12" as unknown as number })).toBe(
      24,
    );
    expect(slaHoursOrDefault({ sla_lead_hours: Number.POSITIVE_INFINITY })).toBe(
      24,
    );
  });
});

describe("aggregateFunnel", () => {
  it("cuenta deals abiertos por etapa rellenando etapas vacias a 0", () => {
    const rows: DealStageCount[] = [
      { stage: "nuevo_lead" },
      { stage: "nuevo_lead" },
      { stage: "visita" },
    ];
    const funnel = aggregateFunnel(rows);
    expect(funnel.map((f) => f.stage_id)).toEqual([
      "nuevo_lead",
      "calificado",
      "visita",
      "negociacion",
      "cierre",
    ]);
    expect(funnel.map((f) => f.count)).toEqual([2, 0, 1, 0, 0]);
    // Etiquetas en espanol tomadas de DEAL_STAGES.
    expect(funnel[0].label).toBe("Nuevo lead");
    expect(funnel[4].label).toBe("Cierre");
  });

  it("ignora defensivamente etapas desconocidas", () => {
    const rows = [{ stage: "fantasma" }] as unknown as DealStageCount[];
    expect(aggregateFunnel(rows).every((f) => f.count === 0)).toBe(true);
  });

  it("lista vacia -> todas las etapas a 0", () => {
    expect(aggregateFunnel([]).reduce((acc, f) => acc + f.count, 0)).toBe(0);
  });
});

describe("sumDealValue", () => {
  it("suma values tratando null como 0", () => {
    expect(sumDealValue([{ value: 100 }, { value: null }, { value: 50.5 }])).toBe(
      150.5,
    );
  });

  it("sin deals devuelve 0", () => {
    expect(sumDealValue([])).toBe(0);
  });
});

describe("splitTodayOverdue", () => {
  function task(id: string, dueDate: string | null): TodayTask {
    return { id, title: `T ${id}`, due_date: dueDate, contact_name: null };
  }

  // Hoy segun dayKey() del runner (local): derivamos las claves del entorno
  // para que el test sea independiente de la TZ donde se ejecute.
  function localKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  const todayKeyStr = localKey(new Date());
  const yesterdayIso = new Date(
    new Date(`${todayKeyStr}T12:00:00`).getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();

  it("hoy agrupa por clave de dia LOCAL igual al dia actual", () => {
    const { hoy } = splitTodayOverdue([
      task("a", `${todayKeyStr}T09:00:00`),
      task("b", `${todayKeyStr}T23:00:00`),
    ], todayKeyStr);
    expect(hoy.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("vencidas son las anteriores a hoy, ordenadas de mas antigua a mas reciente", () => {
    const oldIso = new Date(
      new Date(`${todayKeyStr}T12:00:00`).getTime() - 72 * 60 * 60 * 1000,
    ).toISOString();
    const { vencidas } = splitTodayOverdue([
      task("reciente", yesterdayIso),
      task("antigua", oldIso),
    ], todayKeyStr);
    expect(vencidas.map((t) => t.id)).toEqual(["antigua", "reciente"]);
  });

  it("descarta tareas sin fecha o con fecha invalida", () => {
    const r = splitTodayOverdue([task("x", null), task("y", "basura")], todayKeyStr);
    expect(r.hoy).toHaveLength(0);
    expect(r.vencidas).toHaveLength(0);
  });

  it("no clasifica tareas futuras (manana) en ningun bucket", () => {
    const manana = new Date(
      new Date(`${todayKeyStr}T12:00:00`).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const r = splitTodayOverdue([task("futura", manana)], todayKeyStr);
    expect(r.hoy).toHaveLength(0);
    expect(r.vencidas).toHaveLength(0);
  });
});

describe("pickSlaBreaches", () => {
  const NOW = new Date("2026-08-23T12:00:00Z");

  function contact(id: string, createdAt: string): SlaCandidateContact {
    return {
      id,
      full_name: `Contacto ${id}`,
      created_at: createdAt,
    };
  }

  it("brechea un lead nuevo sin actividad reciente creado antes del corte", () => {
    const breaches = pickSlaBreaches(
      [contact("a", "2026-08-20T00:00:00Z")], // hace ~3 dias
      new Set<string>(),
      NOW,
      24,
    );
    expect(breaches.map((b) => b.id)).toEqual(["a"]);
  });

  it("no brechea si tiene actividad posterior al corte (set de frescos)", () => {
    const breaches = pickSlaBreaches(
      [
        contact("fresco", "2026-08-01T00:00:00Z"),
        contact("parado", "2026-08-01T00:00:00Z"),
      ],
      new Set(["fresco"]),
      NOW,
      24,
    );
    expect(breaches.map((b) => b.id)).toEqual(["parado"]);
  });

  it("lead sin actividad creado hace minutos NO brecha (created_at como referencia)", () => {
    const breaches = pickSlaBreaches(
      [
        contact("nuevo", "2026-08-23T11:00:00Z"), // creado hace 1h
        contact("viejo", "2026-08-20T00:00:00Z"), // creado hace 3 dias
      ],
      new Set<string>(),
      NOW,
      24,
    );
    expect(breaches.map((b) => b.id)).toEqual(["viejo"]);
  });

  it("respeta horas de SLA configurables", () => {
    const breaches = pickSlaBreaches(
      [contact("a", "2026-08-22T11:00:00Z")],
      new Set<string>(),
      NOW,
      48, // corte = 21 ago 12:00; creado 22 ago 11:00 -> dentro
    );
    expect(breaches).toHaveLength(0);
  });

  it("ordenados de mas antiguo a mas reciente y created_at invalido se ignora", () => {
    const breaches = pickSlaBreaches(
      [
        contact("b-reciente", "2026-08-21T00:00:00Z"),
        contact("a-antiguo", "2026-08-10T00:00:00Z"),
        contact("x-invalido", "fecha-mala"),
      ],
      new Set<string>(),
      NOW,
      24,
    );
    expect(breaches.map((b) => b.id)).toEqual(["a-antiguo", "b-reciente"]);
  });

  it("parametros invalidos devuelven lista vacia", () => {
    expect(pickSlaBreachsSafe()).toEqual([]);
  });

  function pickSlaBreachsSafe() {
    return pickSlaBreaches([], new Set<string>(), new Date("basura"), 24);
  }
});
