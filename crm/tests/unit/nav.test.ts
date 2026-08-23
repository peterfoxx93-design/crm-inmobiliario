import { describe, expect, it } from "vitest";

import { getNavItems } from "@/lib/nav";

describe("getNavItems", () => {
  it("incluye las 6 secciones base para un agente", () => {
    const items = getNavItems("agent");
    expect(items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/propiedades",
      "/contactos",
      "/pipeline",
      "/agenda",
      "/ajustes",
    ]);
  });

  it("no muestra Maestro a admin de agencia", () => {
    expect(getNavItems("admin").some((i) => i.href === "/maestro")).toBe(false);
  });

  it("anade Maestro solo para super_admin", () => {
    const items = getNavItems("super_admin");
    expect(items.some((i) => i.href === "/maestro" && i.label === "Maestro")).toBe(
      true,
    );
    expect(items.filter((i) => i.href !== "/maestro")).toHaveLength(6);
  });

  it("usa etiquetas en espanol sin duplicar rutas", () => {
    const items = getNavItems("super_admin");
    const hrefs = items.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
