import { describe, expect, it } from "vitest";

import { groupActivitiesByDay } from "@/lib/feed";
import { formatRelativeTime } from "@/lib/format";
import type { Activity } from "@/lib/types";

function activity(id: string, createdAt: string): Activity {
  return {
    id,
    agency_id: "a",
    contact_id: "c1",
    deal_id: null,
    property_id: null,
    type: "nota",
    title: `Nota ${id}`,
    body: null,
    due_date: null,
    completed_at: null,
    created_by: "u1",
    created_at: createdAt,
  };
}

describe("groupActivitiesByDay", () => {
  const now = new Date("2026-08-22T18:00:00Z");

  it("agrupa por dia descendente y etiqueta Hoy/Ayer", () => {
    const groups = groupActivitiesByDay(
      [
        activity("1", "2026-08-20T10:00:00Z"),
        activity("2", "2026-08-22T09:00:00Z"),
        activity("3", "2026-08-21T15:00:00Z"),
        activity("4", "2026-08-22T17:00:00Z"),
      ],
      now,
    );

    expect(groups.map((g) => g.label)).toEqual(["Hoy", "Ayer", "20 ago 2026"]);
    expect(groups[0].items.map((a) => a.id)).toEqual(["4", "2"]);
    expect(groups[2].items.map((a) => a.id)).toEqual(["1"]);
  });

  it("con lista vacia devuelve cero grupos", () => {
    expect(groupActivitiesByDay([], now)).toEqual([]);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-22T12:00:00Z");

  it("minutos recientes", () => {
    const out = formatRelativeTime("2026-08-22T11:55:00Z", now);
    expect(out).toContain("minuto");
  });

  it("horas y dias", () => {
    expect(formatRelativeTime("2026-08-22T10:00:00Z", now)).toContain("hora");
    expect(formatRelativeTime("2026-08-19T12:00:00Z", now)).toContain("día");
  });

  it("mas de 30 dias cae a fecha corta", () => {
    const out = formatRelativeTime("2026-06-01T12:00:00Z", now);
    expect(out).not.toContain("hace");
    expect(out.length).toBeGreaterThan(0);
  });

  it("fecha invalida devuelve guion", () => {
    expect(formatRelativeTime("no-es-fecha", now)).toBe("—");
  });
});
