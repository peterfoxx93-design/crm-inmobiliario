import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  buildMonthRange,
  dayKey,
  groupTasksByDay,
  shiftDayKey,
  type TaskWithRelations,
} from "@/lib/agenda";

/** Clave local yyyy-MM-dd de un Date segun la TZ del runner (sin hardcodear). */
function expectedLocalKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function task(
  id: string,
  dueDate: string | null,
  overrides: Partial<TaskWithRelations> = {},
): TaskWithRelations {
  return {
    id,
    agency_id: "a",
    contact_id: null,
    deal_id: null,
    property_id: null,
    type: "tarea",
    title: `Tarea ${id}`,
    body: null,
    due_date: dueDate,
    completed_at: null,
    created_by: "u1",
    created_at: "2026-08-01T09:00:00Z",
    contact: null,
    property: null,
    ...overrides,
  };
}

describe("buildMonthRange", () => {
  it("devuelve el rango [from, to) del mes en ISO de fecha", () => {
    expect(buildMonthRange(2026, 8)).toEqual({
      from: "2026-08-01",
      to: "2026-09-01",
    });
  });

  it("cruza el fin de anio correctamente", () => {
    expect(buildMonthRange(2026, 12)).toEqual({
      from: "2026-12-01",
      to: "2027-01-01",
    });
    expect(buildMonthRange(2027, 1)).toEqual({
      from: "2027-01-01",
      to: "2027-02-01",
    });
  });

  it("rellena meses de un digito con cero", () => {
    expect(buildMonthRange(2026, 3)).toEqual({
      from: "2026-03-01",
      to: "2026-04-01",
    });
  });

  it("rechaza meses fuera de 1..12", () => {
    expect(() => buildMonthRange(2026, 0)).toThrow();
    expect(() => buildMonthRange(2026, 13)).toThrow();
  });
});

describe("dayKey", () => {
  it("devuelve la fecha de calendario LOCAL en yyyy-MM-dd", () => {
    // Mediodia UTC: la misma fecha local en offsets >= 0 (runner habitual).
    const iso = "2026-08-23T12:00:00Z";
    expect(dayKey(iso)).toBe(expectedLocalKey(new Date(iso)));
  });

  it("es consistente entre medianoche y mediodia del mismo dia local", () => {
    // Dos instantes del mismo dia local deben compartir clave.
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    const evening = new Date();
    evening.setHours(21, 0, 0, 0);
    expect(dayKey(morning.toISOString())).toBe(dayKey(evening.toISOString()));
  });

  it("fecha invalida devuelve cadena vacia", () => {
    expect(dayKey("no-es-fecha")).toBe("");
  });
});

describe("groupTasksByDay", () => {
  const t22m = task("b", "2026-08-22T10:00:00Z");
  const t22l = task("a", "2026-08-22T18:00:00Z");
  const t23 = task("c", "2026-08-23T09:00:00Z");

  it("agrupa por dia con claves ordenadas ascendente", () => {
    const groups = groupTasksByDay([t23, t22l, t22m]);
    const keys = [...groups.keys()];
    expect(keys).toHaveLength(2);
    expect(keys[0] < keys[1]).toBe(true);
    // El dia 22 contiene solo las tareas del 22.
    expect(groups.get(keys[0])?.map((t) => t.id)).toEqual(["b", "a"]);
    expect(groups.get(keys[1])?.map((t) => t.id)).toEqual(["c"]);
  });

  it("ordena dentro del dia por due_date ascendente", () => {
    const groups = groupTasksByDay([t22l, t22m]);
    const onlyGroup = [...groups.values()][0];
    expect(onlyGroup.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("descarta defensivamente tareas sin due_date", () => {
    const groups = groupTasksByDay([task("x", null)]);
    expect(groups.size).toBe(0);
  });

  it("lista vacia devuelve mapa vacio", () => {
    expect(groupTasksByDay([]).size).toBe(0);
  });
});

describe("addDaysIso", () => {
  it("suma dias preservando el instante relativo (+24h)", () => {
    const out = addDaysIso("2026-08-31T10:30:00.000Z", 1);
    expect(
      new Date(out).getTime() - new Date("2026-08-31T10:30:00.000Z").getTime(),
    ).toBe(24 * 60 * 60 * 1000);
  });

  it("cruza frontera de mes", () => {
    const out = addDaysIso("2026-07-31T12:00:00Z", 3);
    expect(new Date(out).getUTCMonth()).toBe(7); // agosto
    expect(new Date(out).getUTCDate()).toBe(3);
  });

  it("acepta dias negativos para restar", () => {
    const out = addDaysIso("2026-08-01T12:00:00Z", -1);
    expect(new Date(out).getUTCDate()).toBe(31);
    expect(new Date(out).getUTCMonth()).toBe(6); // julio
  });

  it("fecha invalida devuelve cadena vacia", () => {
    expect(addDaysIso("no-es-fecha", 1)).toBe("");
  });
});

describe("shiftDayKey", () => {
  it("suma un dia sobre la clave yyyy-MM-dd (fin de mes)", () => {
    expect(shiftDayKey("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("resta dias cruzando anio", () => {
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("bisiesto: 28 feb + 1 = 29 feb en 2028", () => {
    expect(shiftDayKey("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("clave invalida devuelve cadena vacia", () => {
    expect(shiftDayKey("31-08-2026", 1)).toBe("");
  });
});
