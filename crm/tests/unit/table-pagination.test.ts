import { describe, expect, it } from "vitest";

import { getRowRange } from "@/lib/table-pagination";

describe("getRowRange", () => {
  it("calcula el rango de la primera pagina completa", () => {
    expect(getRowRange(0, 10, 23)).toEqual({ from: 1, to: 10 });
  });

  it("acota el final en la ultima pagina parcial", () => {
    expect(getRowRange(2, 10, 23)).toEqual({ from: 21, to: 23 });
  });

  it("devuelve 0-0 sin datos", () => {
    expect(getRowRange(0, 10, 0)).toEqual({ from: 0, to: 0 });
  });

  it("satura el indice de pagina fuera de rango", () => {
    // pageIndex 99 con 23 filas y paginas de 10 -> ultima pagina (2)
    expect(getRowRange(99, 10, 23)).toEqual({ from: 21, to: 23 });
  });

  it("satura indices negativos a la primera pagina", () => {
    expect(getRowRange(-3, 10, 23)).toEqual({ from: 1, to: 10 });
  });

  it("usa una pagina de minimo 1 fila si pageSize es invalido", () => {
    expect(getRowRange(0, 0, 3)).toEqual({ from: 1, to: 1 });
    expect(getRowRange(2, -5, 3)).toEqual({ from: 3, to: 3 });
  });

  it("es tolerante a entradas no finitas", () => {
    expect(getRowRange(Number.NaN, 10, 23)).toEqual({ from: 1, to: 10 });
    expect(getRowRange(0, Number.NaN, 23)).toEqual({ from: 1, to: 10 });
    expect(getRowRange(0, 10, Number.NaN)).toEqual({ from: 0, to: 0 });
  });
});
