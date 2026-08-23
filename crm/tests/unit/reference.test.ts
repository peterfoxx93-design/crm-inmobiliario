import { describe, expect, it } from "vitest";

import { buildReference, parseReferenceSeq } from "@/lib/format";

/**
 * Task 10: helpers de referencia usados por createProperty
 * (select max(reference) -> parse -> buildReference).
 */
describe("parseReferenceSeq", () => {
  it.each([
    ["REF-0001", 1],
    ["REF-0042", 42],
    ["REF-1234", 1234],
    ["REF-9999", 9999],
  ])("extrae la secuencia de %s", (reference, expected) => {
    expect(parseReferenceSeq(reference)).toBe(expected);
  });

  it("acepta secuencias de mas de 4 digitos (sin padding perdido)", () => {
    expect(parseReferenceSeq("REF-12345")).toBe(12345);
  });

  it.each([
    "ref-0042", // solo mayusculas
    "REF-", // sin secuencia
    "REF-abc", // secuencia no numerica
    "PROP-0042", // prefijo incorrecto
    "0042", // sin prefijo
    "", // vacia
  ])("devuelve null para formato invalido (%j)", (reference) => {
    expect(parseReferenceSeq(reference)).toBeNull();
  });

  it("es inversa de buildReference (roundtrip)", () => {
    for (const seq of [1, 7, 42, 999, 5000]) {
      const reference = buildReference(seq);
      expect(parseReferenceSeq(reference)).toBe(seq);
    }
  });
});
