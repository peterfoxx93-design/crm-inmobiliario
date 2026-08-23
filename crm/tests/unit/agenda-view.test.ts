import { describe, expect, it } from "vitest";

import {
  parseAgendaView,
  viewToSearchParams,
  type AgendaViewState,
} from "@/lib/agenda-view";

describe("parseAgendaView", () => {
  it("sin params devuelve vista dia sin fecha", () => {
    expect(parseAgendaView({})).toEqual({
      vista: "dia",
      dia: null,
      mes: null,
    });
  });

  it("lee vista=mes", () => {
    expect(parseAgendaView({ vista: "mes" }).vista).toBe("mes");
  });

  it("cualquier valor ajeno a dia|mes cae a dia", () => {
    expect(parseAgendaView({ vista: "semana" }).vista).toBe("dia");
    // Valor multiple: se toma el primero.
    expect(parseAgendaView({ vista: ["mes", "dia"] }).vista).toBe("mes");
  });

  it("valida dia con formato YYYY-MM-DD y rechaza el resto", () => {
    expect(parseAgendaView({ dia: "2026-08-23" }).dia).toBe("2026-08-23");
    expect(parseAgendaView({ dia: "23-08-2026" }).dia).toBeNull();
    expect(parseAgendaView({ dia: "2026-8-1" }).dia).toBeNull();
  });

  it("rechaza dias con formato valido pero fecha de calendario inexistente", () => {
    // Regresion Task 19: pasaban el regex y luego rompian la pagina con
    // RangeError al construir new Date() sobre claves imposibles.
    expect(parseAgendaView({ dia: "2026-02-30" }).dia).toBeNull();
    expect(parseAgendaView({ dia: "2026-13-01" }).dia).toBeNull();
    expect(parseAgendaView({ dia: "2026-04-31" }).dia).toBeNull();
    expect(parseAgendaView({ dia: "2026-02-29" }).dia).toBeNull(); // no bisiesto
  });

  it("acepta dias reales del calendario, incluido bisiesto", () => {
    expect(parseAgendaView({ dia: "2028-02-29" }).dia).toBe("2028-02-29");
    expect(parseAgendaView({ dia: "2024-12-31" }).dia).toBe("2024-12-31");
  });

  it("valida mes con formato YYYY-MM y rechaza el resto", () => {
    expect(parseAgendaView({ mes: "2026-08" }).mes).toBe("2026-08");
    expect(parseAgendaView({ mes: "agosto" }).mes).toBeNull();
    // Regresion Task 19: el mes 13 pasaba el regex y provocaba RangeError
    // en la cabecera de /agenda al formatear new Date("2026-13-01T...").
    expect(parseAgendaView({ mes: "2026-13" }).mes).toBeNull();
    expect(parseAgendaView({ mes: "2026-00" }).mes).toBeNull();
    expect(parseAgendaView({ mes: "2025-12" }).mes).toBe("2025-12");
  });
});

describe("viewToSearchParams", () => {
  const state: AgendaViewState = {
    vista: "mes",
    dia: "2026-08-23",
    mes: "2026-08",
  };

  it("al ir a dia omite vista (default) y conserva dia/mes", () => {
    const sp = viewToSearchParams(state, "dia");
    expect(sp.get("vista")).toBeNull();
    expect(sp.get("dia")).toBe("2026-08-23");
    expect(sp.get("mes")).toBe("2026-08");
  });

  it("al ir a mes serializa vista=mes conservando dia/mes", () => {
    const sp = viewToSearchParams(state, "mes");
    expect(sp.get("vista")).toBe("mes");
    expect(sp.get("dia")).toBe("2026-08-23");
    expect(sp.get("mes")).toBe("2026-08");
  });

  it("omite los campos ausentes", () => {
    const sp = viewToSearchParams(
      { vista: "dia", dia: null, mes: null },
      "dia",
    );
    expect([...sp.keys()]).toEqual([]);
  });
});
