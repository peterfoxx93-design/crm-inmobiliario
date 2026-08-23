import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  parseHex,
  pickBrandForeground,
  relativeLuminance,
} from "@/lib/color";

describe("parseHex", () => {
  it("parsea hex de 6 digitos con y sin almohadilla", () => {
    expect(parseHex("#2563eb")).toEqual([0x25, 0x63, 0xeb]);
    expect(parseHex("2563EB")).toEqual([0x25, 0x63, 0xeb]);
  });

  it("expande formato corto de 3 digitos", () => {
    expect(parseHex("#f0a")).toEqual([0xff, 0x00, 0xaa]);
  });

  it("devuelve null para entradas invalidas", () => {
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("azul")).toBeNull();
    expect(parseHex("#gggggg")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("negro puro vale 0 y blanco puro vale 1", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
  });

  it("devuelve null si el color no es valido", () => {
    expect(relativeLuminance("no-color")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("blanco sobre negro da el maximo (21)", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
  });

  it("es simetrica e independiente del orden", () => {
    expect(contrastRatio("#2563eb", "#ffffff")).toBe(
      contrastRatio("#ffffff", "#2563eb"),
    );
  });

  it("devuelve null ante colores invalidos", () => {
    expect(contrastRatio("zzz", "#ffffff")).toBeNull();
  });
});

describe("pickBrandForeground", () => {
  it("elige blanco sobre un azul oscuro", () => {
    expect(pickBrandForeground("#2563eb")).toBe("#ffffff");
  });

  it("elige negro sobre un amarillo claro", () => {
    expect(pickBrandForeground("#fde047")).toBe("#000000");
  });

  it("normaliza a mayusculas", () => {
    const r = pickBrandForeground("#2563eb");
    expect(r === "#ffffff" || r === "#000000").toBe(true);
  });

  it("cae a blanco si el color no se puede parsear", () => {
    expect(pickBrandForeground("no-es-color")).toBe("#ffffff");
  });
});
