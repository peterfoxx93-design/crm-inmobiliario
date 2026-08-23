import { describe, expect, it } from "vitest";

import { computePositions, buildReorderWrites } from "@/lib/gallery";

/**
 * Task 10: logica de posiciones del reorder de la galeria.
 * UI y server action comparten esta funcion, asi que sus posiciones
 * deben ser consecutivas 1-based y reflejar exactamente el orden dado.
 */
describe("computePositions", () => {
  it("asigna posiciones 1-based segun el orden dado", () => {
    expect(computePositions(["a", "b", "c"])).toEqual([
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "c", position: 3 },
    ]);
  });

  it("refleja un reorder (mover 'a' al final)", () => {
    expect(computePositions(["b", "c", "a"])).toEqual([
      { id: "b", position: 1 },
      { id: "c", position: 2 },
      { id: "a", position: 3 },
    ]);
  });

  it("devuelve [] para una galeria vacia", () => {
    expect(computePositions([])).toEqual([]);
  });

  it("es determinista ante ids repetidos (no rompe posiciones)", () => {
    const result = computePositions(["x", "x"]);
    expect(result.map((r) => r.position)).toEqual([1, 2]);
  });
});

/**
 * Task 10 review fix C1: la escritura del reorder NO puede ser secuencial
 * con posiciones finales porque `unique(property_id, position)` y el layout
 * es denso ([A(1),B(2)] -> [B,A] exige B->1 mientras A sigue en 1).
 * buildReorderWrites produce la estrategia en DOS fases: primero offsets
 * temporales negativos distintos (liberan todos los slots), luego las
 * posiciones finales 1..N.
 */
describe("buildReorderWrites", () => {
  it("el caso que rompia la constraint: [A,B] -> [B,A] pasa por negativos", () => {
    expect(buildReorderWrites(["b", "a"])).toEqual([
      // Fase 1: offsets temporales negativos distintos.
      { id: "b", position: -1 },
      { id: "a", position: -2 },
      // Fase 2: posiciones finales 1..N.
      { id: "b", position: 1 },
      { id: "a", position: 2 },
    ]);
  });

  it("la fase 1 nunca colisiona: todos los offsets negativos son distintos", () => {
    const ids = ["a", "b", "c", "d"];
    const writes = buildReorderWrites(ids);
    const phaseOne = writes.slice(0, ids.length);
    expect(phaseOne.every((w) => w.position < 0)).toBe(true);
    expect(new Set(phaseOne.map((w) => w.position)).size).toBe(ids.length);
  });

  it("la fase 2 coincide con computePositions (posiciones finales 1..N)", () => {
    const ids = ["c", "a", "b"];
    expect(buildReorderWrites(ids).slice(ids.length)).toEqual(computePositions(ids));
  });

  it("con un solo elemento tambien usa dos fases (contrato uniforme)", () => {
    expect(buildReorderWrites(["solo"])).toEqual([
      { id: "solo", position: -1 },
      { id: "solo", position: 1 },
    ]);
  });

  it("devuelve [] para una lista vacia", () => {
    expect(buildReorderWrites([])).toEqual([]);
  });
});
