import { describe, expect, it } from "vitest";

import {
  parseViewParam,
  splitByCoords,
  viewToSearchParams,
} from "@/lib/map-view";
import { parsePropertyFilters } from "@/lib/property-filters";

describe("splitByCoords", () => {
  it("separa propiedades ubicables de las sin coordenadas", () => {
    const items = [
      { lat: 40.4, lng: -3.7 },
      { lat: null, lng: -3.7 },
      { lat: 41.0, lng: null },
      { lat: null, lng: null },
      { lat: 39.5, lng: -0.4 },
    ];
    const { withCoords, withoutCoords } = splitByCoords(items);
    expect(withCoords).toHaveLength(2);
    expect(withCoords[0]).toEqual({ lat: 40.4, lng: -3.7 });
    expect(withoutCoords).toHaveLength(3);
  });

  it("descarta coordenadas no finitas", () => {
    const items = [
      { lat: Number.NaN, lng: -3.7 },
      { lat: 40, lng: Number.POSITIVE_INFINITY },
    ];
    const { withCoords, withoutCoords } = splitByCoords(items);
    expect(withCoords).toHaveLength(0);
    expect(withoutCoords).toHaveLength(2);
  });

  it("devuelve dos listas vacias con entrada vacia", () => {
    const { withCoords, withoutCoords } = splitByCoords([]);
    expect(withCoords).toEqual([]);
    expect(withoutCoords).toEqual([]);
  });
});

describe("parseViewParam", () => {
  it("reconoce vista=mapa", () => {
    expect(parseViewParam({ vista: "mapa" })).toBe("mapa");
  });

  it("cualquier otra cosa es lista", () => {
    expect(parseViewParam({})).toBe("lista");
    expect(parseViewParam({ vista: "lista" })).toBe("lista");
    expect(parseViewParam({ vista: "MAPA" })).toBe("lista");
    expect(parseViewParam({ vista: ["mapa"] })).toBe("mapa");
    expect(parseViewParam({ vista: undefined })).toBe("lista");
  });
});

describe("viewToSearchParams", () => {
  it("preserva filtros y anade vista=mapa", () => {
    const filters = parsePropertyFilters({
      q: "atico",
      status: "activo",
      page: "2",
    });
    const qs = viewToSearchParams(filters, "mapa").toString();
    expect(qs).toContain("q=atico");
    expect(qs).toContain("status=activo");
    expect(qs).toContain("page=2");
    expect(qs).toContain("vista=mapa");
  });

  it("omite vista en modo lista y pagina por defecto", () => {
    const filters = parsePropertyFilters({});
    const qs = viewToSearchParams(filters, "lista").toString();
    expect(qs).not.toContain("vista=");
    expect(qs).not.toContain("page=");
  });

  it("ida y vuelta: parseViewParam lee lo que serializa viewToSearchParams", () => {
    const sp = viewToSearchParams(parsePropertyFilters({}), "mapa");
    const params: Record<string, string> = {};
    for (const [k, v] of sp.entries()) params[k] = v;
    expect(parseViewParam(params)).toBe("mapa");
  });
});
