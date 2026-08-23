import { describe, expect, it } from "vitest";

import { sanitizeSearchTerm } from "@/lib/search";

describe("sanitizeSearchTerm", () => {
  it("elimina la coma que rompe el parser .or() de PostgREST", () => {
    expect(sanitizeSearchTerm("casa, piso")).toBe("casa  piso");
  });

  it("elimina las comillas dobles", () => {
    expect(sanitizeSearchTerm('piso "nuevo"')).toBe("piso  nuevo");
  });

  it("elimina el guion bajo (comodin de una letra en LIKE)", () => {
    expect(sanitizeSearchTerm("casa_norte")).toBe("casa norte");
  });

  it("mantiene la sanitizacion previa de %, ( y )", () => {
    expect(sanitizeSearchTerm("50% (rebajado)")).toBe("50   rebajado");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(sanitizeSearchTerm("  casa sur  ")).toBe("casa sur");
  });

  it("no altera un termino ya limpio", () => {
    expect(sanitizeSearchTerm("casa sur")).toBe("casa sur");
  });

  it("no deja ningun caracter reservado tras sanitizar", () => {
    const sucio = 'a%,()b"c_d';
    expect(sanitizeSearchTerm(sucio)).not.toMatch(/[%,()"_]/);
  });
});
