import { describe, expect, it } from "vitest";

import {
  agencySlugSchema,
  pipelineStageDaysSchema,
  upsertAgencyInputSchema,
} from "@/lib/validators/agency";

/**
 * Brief Task 17: esquema de entrada de upsertAgency.
 * - color hex normalizado (reusa hexColorSchema de Task 16);
 * - slug opcional con formato valido (si falta, la accion lo genera);
 * - sla_lead_hours numerico sano;
 * - pipeline_stage_days con claves subset estricto de DEAL_STAGES y valores
 *   enteros positivos razonables;
 * - web_form con forma cerrada (booleans + mensaje corto).
 */

describe("agencySlugSchema", () => {
  it.each(["fincas-sur", "fincas24", "a", "inmobiliaria-del-mar-menor"])(
    "acepta slug valido %j",
    (slug) => {
      expect(agencySlugSchema.safeParse(slug).success).toBe(true);
    },
  );

  it.each([
    "Fincas Sur", // espacios
    "Fincas-Sur", // mayusculas
    "-fincas-", // guiones en extremos
    "fin--cas", // guion doble
    "", // vacio
    "fincas_sur", // guion bajo
    "cafés", // acento
  ])("rechaza slug invalido %j", (slug) => {
    expect(agencySlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("pipelineStageDaysSchema", () => {
  it("acepta claves validas de DEAL_STAGES con dias enteros", () => {
    const result = pipelineStageDaysSchema.safeParse({
      nuevo_lead: 2,
      visita: 5,
      negociacion: 30,
    });
    expect(result.success).toBe(true);
  });

  it("acepta objeto vacio (sin limites por etapa)", () => {
    expect(pipelineStageDaysSchema.safeParse({}).success).toBe(true);
  });

  it("rechaza claves fuera de DEAL_STAGES", () => {
    expect(
      pipelineStageDaysSchema.safeParse({ nuevo_lead: 2, otro: 3 }).success,
    ).toBe(false);
  });

  it.each([0, -3, 1.5, 366])("rechaza valor de dias invalido (%j)", (days) => {
    expect(pipelineStageDaysSchema.safeParse({ cierre: days }).success).toBe(
      false,
    );
  });
});

describe("upsertAgencyInputSchema", () => {
  it("acepta un alta minima (solo nombre y color) y normaliza", () => {
    const result = upsertAgencyInputSchema.safeParse({
      name: "  Fincas Sur  ",
      color: "#0A7B5B",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Fincas Sur");
      expect(result.data.color).toBe("#0a7b5b");
      expect(result.data.slug).toBeUndefined();
    }
  });

  it("acepta id null (alta) o uuid (edicion)", () => {
    expect(
      upsertAgencyInputSchema.safeParse({
        id: null,
        name: "Nueva",
        color: "#2563eb",
      }).success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({
        id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
        name: "Editada",
        color: "#2563eb",
      }).success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({ id: "abc", name: "X", color: "#fff" })
        .success,
    ).toBe(false);
  });

  it("valida logoUrl: https ok, http/javascript rechazados, null permitido", () => {
    const base = { name: "A", color: "#000000" };
    expect(
      upsertAgencyInputSchema.safeParse({ ...base, logoUrl: "https://x.es/l.png" })
        .success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({ ...base, logoUrl: null }).success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({ ...base, logoUrl: "http://x.es/l.png" })
        .success,
    ).toBe(false);
    expect(
      upsertAgencyInputSchema.safeParse({
        ...base,
        logoUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it.each([-1, 721, 1.5])("rechaza slaLeadHours invalido (%j)", (hours) => {
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        slaLeadHours: hours,
      }).success,
    ).toBe(false);
  });

  it("acepta slaLeadHours nulo (sin SLA)", () => {
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        slaLeadHours: null,
      }).success,
    ).toBe(true);
  });

  it("propaga pipeline_stage_days validos y rechaza invalidos", () => {
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        pipelineStageDays: { cierre: 7 },
      }).success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        pipelineStageDays: { inventado: 7 },
      }).success,
    ).toBe(false);
  });

  it("web_form tiene forma cerrada (booleans y mensaje corto)", () => {
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        webForm: { enabled: true, showEmail: false, showMessage: true },
      }).success,
    ).toBe(true);
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        webForm: { enabled: "si" },
      }).success,
    ).toBe(false);
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#000000",
        webForm: { gracias: "x".repeat(300) },
      }).success,
    ).toBe(false);
  });

  it("exige nombre y color; rechaza claves desconocidas", () => {
    expect(upsertAgencyInputSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(upsertAgencyInputSchema.safeParse({ color: "#ffffff" }).success).toBe(
      false,
    );
    expect(
      upsertAgencyInputSchema.safeParse({
        name: "A",
        color: "#ffffff",
        active: true, // el toggle va por toggleAgencyActive, no aqui
      }).success,
    ).toBe(false);
  });
});
