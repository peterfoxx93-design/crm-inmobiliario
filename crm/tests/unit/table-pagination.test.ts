import { describe, expect, it } from "vitest";

import { clampPageIndex, getRowRange } from "@/lib/table-pagination";

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

describe("clampPageIndex", () => {
  it("devuelve el indice sin cambios si esta en rango", () => {
    expect(clampPageIndex(0, 3)).toBe(0);
    expect(clampPageIndex(2, 3)).toBe(2);
  });

  it("satura un indice huerfano a la ultima pagina valida", () => {
    // tras borrar la ultima fila de la ultima pagina: pageIndex 2 con pageCount 2
    expect(clampPageIndex(2, 2)).toBe(1);
    expect(clampPageIndex(99, 3)).toBe(2);
  });

  it("satura indices negativos a la primera pagina", () => {
    expect(clampPageIndex(-4, 3)).toBe(0);
  });

  it("garantiza al menos una pagina aunque pageCount sea invalido", () => {
    expect(clampPageIndex(0, 0)).toBe(0);
    expect(clampPageIndex(5, 0)).toBe(0);
    expect(clampPageIndex(5, Number.NaN)).toBe(0);
  });

  it("es tolerante a entradas no finitas", () => {
    // Igual que getRowRange: cualquier indice no finito se trata como invalido.
    expect(clampPageIndex(Number.NaN, 3)).toBe(0);
    expect(clampPageIndex(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(clampPageIndex(5, Number.NaN)).toBe(0);
  });

  it("trunca indices decimales", () => {
    expect(clampPageIndex(1.9, 3)).toBe(1);
  });
});
