import { describe, expect, it } from "vitest";

import {
  groupDealsByStage,
  sumStageValues,
  type DealWithRelations,
} from "@/lib/pipeline";
import type { DealStage } from "@/lib/types";

/** Deal minimo valido para tests (solo lo que consumen los helpers). */
function makeDeal(
  id: string,
  stage: DealStage,
  value: number | null = null,
): DealWithRelations {
  return {
    id,
    agency_id: "00000000-0000-0000-0000-000000000001",
    contact_id: "00000000-0000-0000-0000-000000000002",
    property_id: null,
    agent_id: "00000000-0000-0000-0000-000000000003",
    stage,
    value,
    notes: null,
    won: null,
    lost_reason: null,
    stage_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contact: { full_name: `Contacto ${id}` },
    property: null,
    agent: { full_name: "Agente", avatar_url: null },
  };
}

describe("groupDealsByStage", () => {
  it("devuelve las 5 etapas siempre, vacias si toca", () => {
    const grouped = groupDealsByStage([]);
    expect(Object.keys(grouped)).toHaveLength(5);
    expect(grouped.nuevo_lead).toEqual([]);
    expect(grouped.cierre).toEqual([]);
  });

  it("agrupa cada deal en su etapa", () => {
    const a = makeDeal("a", "nuevo_lead", 100);
    const b = makeDeal("b", "visita", 200);
    const c = makeDeal("c", "nuevo_lead", 300);

    const grouped = groupDealsByStage([a, b, c]);

    expect(grouped.nuevo_lead.map((d) => d.id)).toEqual(["a", "c"]);
    expect(grouped.visita.map((d) => d.id)).toEqual(["b"]);
    expect(grouped.calificado).toEqual([]);
  });
});

describe("sumStageValues", () => {
  it("suma los importes de la columna", () => {
    expect(sumStageValues([makeDeal("a", "visita", 100), makeDeal("b", "visita", 250.5)])).toBe(
      350.5,
    );
  });

  it("trata los valores nulos como 0", () => {
    expect(sumStageValues([makeDeal("a", "visita", null), makeDeal("b", "visita", 100)])).toBe(
      100,
    );
  });

  it("suma 0 en columna vacia", () => {
    expect(sumStageValues([])).toBe(0);
  });
});
