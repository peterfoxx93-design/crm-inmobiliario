import { describe, expect, it } from "vitest";

import {
  filtersToSearchParams,
  hasActivePropertyFilters,
  parsePropertyFilters,
  withoutPropertyFilters,
} from "@/lib/property-filters";

describe("parsePropertyFilters", () => {
  it("devuelve filtros vacios y pagina 1 sin searchParams", () => {
    expect(parsePropertyFilters({})).toEqual({ page: 1 });
  });

  it("parsea q recortado", () => {
    expect(parsePropertyFilters({ q: "  ático  " })).toEqual({ q: "ático", page: 1 });
  });

  it("descarta enums no validos", () => {
    const f = parsePropertyFilters({ status: "hackeado", operation: "venta" });
    expect(f.status).toBeUndefined();
    expect(f.operation).toBe("venta");
  });

  it("usa solo el primer valor si llega un array", () => {
    const f = parsePropertyFilters({ status: ["activo", "retirado"] });
    expect(f.status).toBe("activo");
  });

  it("parsea precios numericos validos y descarta basura", () => {
    const f = parsePropertyFilters({ priceMin: "100000", priceMax: "abc", page: "2" });
    expect(f.priceMin).toBe(100000);
    expect(f.priceMax).toBeUndefined();
    expect(f.page).toBe(2);
  });

  it("descarta precios negativos o no finitos", () => {
    expect(parsePropertyFilters({ priceMin: "-5" }).priceMin).toBeUndefined();
    expect(parsePropertyFilters({ priceMax: "Infinity" }).priceMax).toBeUndefined();
  });

  it("satura paginas invalidas a 1", () => {
    expect(parsePropertyFilters({ page: "0" }).page).toBe(1);
    expect(parsePropertyFilters({ page: "-3" }).page).toBe(1);
    expect(parsePropertyFilters({ page: "xx" }).page).toBe(1);
  });

  it("trunca q demasiado largo", () => {
    const f = parsePropertyFilters({ q: "a".repeat(150) });
    expect(f.q?.length).toBe(100);
  });
});

describe("filtersToSearchParams", () => {
  it("serializa solo los filtros activos", () => {
    const qs = filtersToSearchParams({
      q: "mar",
      operation: "alquiler",
      page: 1,
    }).toString();
    expect(qs).toBe("q=mar&operation=alquiler");
  });

  it("incluye page solo a partir de la 2", () => {
    expect(
      filtersToSearchParams({ status: "activo", page: 3 }).toString(),
    ).toBe("status=activo&page=3");
  });

  it("hace round-trip con parsePropertyFilters", () => {
    const original = parsePropertyFilters({
      q: "centro",
      status: "reservado",
      operation: "venta",
      property_type: "piso",
      priceMin: "50000",
      priceMax: "250000",
      page: "4",
    });
    const parsed = parsePropertyFilters(
      Object.fromEntries(filtersToSearchParams(original)),
    );
    expect(parsed).toEqual(original);
  });
});

describe("withoutPropertyFilters", () => {
  it("elimina las claves indicadas y reinicia la pagina", () => {
    const next = withoutPropertyFilters(
      parsePropertyFilters({ q: "sol", status: "activo", page: "5" }),
      ["q"],
    );
    expect(next).toEqual({ status: "activo", page: 1 });
  });

  it("elimina varias claves a la vez", () => {
    const base = parsePropertyFilters({
      q: "sol",
      priceMin: "10",
      priceMax: "99",
      operation: "venta",
    });
    const next = withoutPropertyFilters(base, ["priceMin", "priceMax"]);
    expect(next).toEqual({ q: "sol", operation: "venta", page: 1 });
  });

  it("no muta el objeto original", () => {
    const base = parsePropertyFilters({ q: "sol", page: "2" });
    withoutPropertyFilters(base, ["q"]);
    expect(base.q).toBe("sol");
    expect(base.page).toBe(2);
  });
});

describe("hasActivePropertyFilters", () => {
  it("false sin filtros", () => {
    expect(hasActivePropertyFilters(parsePropertyFilters({}))).toBe(false);
    expect(hasActivePropertyFilters(parsePropertyFilters({ page: "3" }))).toBe(false);
  });

  it("true con cualquier filtro activo", () => {
    expect(hasActivePropertyFilters(parsePropertyFilters({ q: "x" }))).toBe(true);
    expect(hasActivePropertyFilters(parsePropertyFilters({ priceMin: "1" }))).toBe(true);
  });
});
