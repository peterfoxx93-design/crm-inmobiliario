import { describe, expect, it } from "vitest";

import { computePositions } from "@/lib/gallery";

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
