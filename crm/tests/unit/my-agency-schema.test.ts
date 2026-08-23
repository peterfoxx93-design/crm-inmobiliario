import { describe, expect, it } from "vitest";

import { brandSchema, hexColorSchema } from "@/lib/validators/my-agency";
import { parseSettingsTab } from "@/lib/settings-view";

/**
 * Brief Task 16 (Step 2/3): esquema del formulario de branding y parseo
 * del tab por querystring (`?tab=usuarios|branding`, patron Agenda).
 * - El color primario debe ser hex valido y se NORMALIZA a #rrggbb minusculas
 *   para que BrandProvider/color.ts lo consuman siempre igual.
 * - Al menos un campo debe venir presente para llamar a updateMyAgencyBrand.
 */

describe("hexColorSchema", () => {
  it.each([
    ["#2563eb", "#2563eb"],
    ["#F8F9FA", "#f8f9fa"], // mayusculas -> minusculas
    ["#f00", "#ff0000"], // shorthand 3 digitos -> expandido
    ["2563eb", "#2563eb"], // sin almohadilla se acepta (parseHex)
    ["  #2563EB  ", "#2563eb"], // se recorta
  ])("acepta y normaliza %j -> %j", (input, expected) => {
    const result = hexColorSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(expected);
  });

  it.each([
    ["rojo"],
    ["#12"], // demasiado corto
    ["#12345"], // longitud invalida
    ["#1234567"], // longitud invalida
    ["##2563eb"],
    [""],
    [undefined],
    [null],
    [42],
  ])("rechaza color invalido (%j)", (input) => {
    expect(hexColorSchema.safeParse(input).success).toBe(false);
  });
});

describe("brandSchema", () => {
  it("acepta una actualizacion completa", () => {
    const result = brandSchema.safeParse({
      name: "  Inmobiliaria Sur  ",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#0A7B5B",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Inmobiliaria Sur");
      expect(result.data.primaryColor).toBe("#0a7b5b");
    }
  });

  it("acepta una actualizacion parcial (solo nombre)", () => {
    const result = brandSchema.safeParse({ name: "Inmobiliaria Sur" });

    expect(result.success).toBe(true);
  });

  it("acepta limpiar el logo con logoUrl null", () => {
    const result = brandSchema.safeParse({ logoUrl: null });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.logoUrl).toBeNull();
  });

  it("rechaza un objeto vacio (nada que guardar)", () => {
    const result = brandSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rechaza nombre en blanco", () => {
    expect(brandSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it.each([
    ["no-es-url"],
    ["//sin-esquema.com/logo.png"],
    ["https://ejemplo con espacios.com/logo.png"], // host invalido
  ])("rechaza logoUrl invalido (%j)", (logoUrl) => {
    expect(brandSchema.safeParse({ logoUrl }).success).toBe(false);
  });

  // Endurecimiento review Task 16: .url() de zod acepta javascript:/data:/http.
  it.each([
    ["javascript:alert(1)"],
    ["data:image/png;base64,AAAA"],
    ["http://insecure.example/logo.png"],
    ["ftp://files.example/logo.png"],
  ])("rechaza logoUrl con esquema no https (%j)", (logoUrl) => {
    expect(brandSchema.safeParse({ logoUrl }).success).toBe(false);
  });
});

describe("parseSettingsTab", () => {
  const asParams = (tab: unknown) =>
    ({ tab }) as Record<string, string | string[] | undefined>;

  it("devuelve branding por defecto (sin param, vacio o invalido)", () => {
    expect(parseSettingsTab({})).toBe("branding");
    expect(parseSettingsTab(asParams(undefined))).toBe("branding");
    expect(parseSettingsTab(asParams(""))).toBe("branding");
    expect(parseSettingsTab(asParams("otra-cosa"))).toBe("branding");
  });

  it("reconoce usuarios y branding (string o primer valor de array)", () => {
    expect(parseSettingsTab(asParams("usuarios"))).toBe("usuarios");
    expect(parseSettingsTab(asParams("branding"))).toBe("branding");
    expect(parseSettingsTab(asParams(["usuarios", "branding"]))).toBe(
      "usuarios",
    );
  });

  it("reconoce la tab captacion (Task 18)", () => {
    expect(parseSettingsTab(asParams("captacion"))).toBe("captacion");
    expect(parseSettingsTab(asParams(["captacion", "usuarios"]))).toBe(
      "captacion",
    );
  });
});
