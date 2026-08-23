import { describe, expect, it } from "vitest";

import {
  contactFiltersToSearchParams,
  hasActiveContactFilters,
  parseContactFilters,
  withoutContactFilters,
} from "@/lib/contact-filters";

describe("parseContactFilters", () => {
  it("parsea q/status/source/assigned_to validos", () => {
    const filters = parseContactFilters({
      q: "garcia",
      status: "nuevo",
      source: "portal",
      assigned_to: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      page: "3",
    });
    expect(filters.q).toBe("garcia");
    expect(filters.status).toBe("nuevo");
    expect(filters.source).toBe("portal");
    expect(filters.assigned_to).toBe("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d");
    expect(filters.page).toBe(3);
  });

  it("descarta valores desconocidos sin fallar", () => {
    const filters = parseContactFilters({
      status: "dios",
      source: "ouija",
      assigned_to: "no-es-un-uuid",
      page: "-2",
    });
    expect(filters.status).toBeUndefined();
    expect(filters.source).toBeUndefined();
    expect(filters.assigned_to).toBeUndefined();
    expect(filters.page).toBe(1);
  });

  it("recorta y limita la longitud de q", () => {
    const filters = parseContactFilters({ q: `  ${"x".repeat(150)}  ` });
    expect(filters.q).toHaveLength(100);
  });

  it("sin params devuelve solo page=1", () => {
    expect(parseContactFilters({})).toEqual({ page: 1 });
  });
});

describe("contactFiltersToSearchParams", () => {
  it("serializa omitiendo vacios y page=1", () => {
    const sp = contactFiltersToSearchParams(
      parseContactFilters({ status: "nuevo", page: "2" }),
    ).toString();
    expect(sp).toContain("status=nuevo");
    expect(sp).toContain("page=2");
    expect(sp).not.toContain("q=");
  });

  it("ida y vuelta con los filtros activos", () => {
    const original = { q: "luis", source: "web" };
    const sp = contactFiltersToSearchParams(
      parseContactFilters(original),
    );
    const params: Record<string, string> = {};
    for (const [k, v] of sp.entries()) params[k] = v;
    const roundTrip = parseContactFilters(params);
    expect(roundTrip.q).toBe("luis");
    expect(roundTrip.source).toBe("web");
  });
});

describe("withoutContactFilters / hasActiveContactFilters", () => {
  it("remueve claves y reinicia pagina", () => {
    const filters = parseContactFilters({ q: "ana", status: "nuevo", page: "5" });
    const next = withoutContactFilters(filters, ["status"]);
    expect(next.status).toBeUndefined();
    expect(next.q).toBe("ana");
    expect(next.page).toBe(1);
  });

  it("detecta filtros activos", () => {
    expect(hasActiveContactFilters(parseContactFilters({}))).toBe(false);
    expect(hasActiveContactFilters(parseContactFilters({ q: "x" }))).toBe(true);
  });
});
