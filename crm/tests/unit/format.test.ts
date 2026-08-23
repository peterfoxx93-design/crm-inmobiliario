import { describe, expect, it } from "vitest";

import { buildReference, formatCurrency, formatDate, isStageOverdue } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("formatCurrency", () => {
  it("formatea EUR en es-ES con separador de miles", () => {
    expect(formatCurrency(250000)).toContain("250.000");
  });

  it("incluye el simbolo del euro", () => {
    expect(formatCurrency(250000)).toContain("€");
  });

  it("formatea decimales con coma y separador de miles", () => {
    // CLDR es-ES: minimo de agrupacion = 2 digitos (no agrupa < 10.000)
    expect(formatCurrency(12345.5)).toContain("12.345,50");
  });
});

describe("buildReference", () => {
  it("rellena con ceros hasta 4 digitos", () => {
    expect(buildReference(7)).toBe("REF-0007");
  });

  it("no recorta secuencias grandes", () => {
    expect(buildReference(12345)).toBe("REF-12345");
  });

  it("maneja la secuencia inicial", () => {
    expect(buildReference(1)).toBe("REF-0001");
  });
});

describe("formatDate", () => {
  it("formatea dd MMM yyyy en espanol", () => {
    expect(formatDate(new Date(2025, 2, 5))).toBe("05 mar 2025");
  });

  it("acepta cadenas ISO", () => {
    expect(formatDate("2025-11-15T10:00:00Z")).toMatch(/^15 nov 2025$/);
  });
});

describe("isStageOverdue", () => {
  it("devuelve false para una etapa reciente", () => {
    const hace1Dia = new Date(Date.now() - 1 * DAY_MS);
    expect(isStageOverdue(hace1Dia, 7)).toBe(false);
  });

  it("devuelve true cuando supera el limite de dias", () => {
    const hace8Dias = new Date(Date.now() - 8 * DAY_MS);
    expect(isStageOverdue(hace8Dias, 7)).toBe(true);
  });

  it("devuelve false justo por debajo del limite", () => {
    const casi7Dias = new Date(Date.now() - 7 * DAY_MS + 60_000);
    expect(isStageOverdue(casi7Dias, 7)).toBe(false);
  });

  it("acepta cadenas ISO", () => {
    const hace10Dias = new Date(Date.now() - 10 * DAY_MS).toISOString();
    expect(isStageOverdue(hace10Dias, 7)).toBe(true);
  });
});
