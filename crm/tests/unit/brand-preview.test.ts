// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyBrandPreview,
  BRAND_PREVIEW_FG_VAR,
  BRAND_PREVIEW_VAR,
  buildBrandStyle,
  clearBrandPreview,
} from "@/lib/brand-preview";
import { pickBrandForeground } from "@/lib/color";

/**
 * Fix review Task 16: el preview en vivo del color de marca debe verse en
 * TODO el shell. BrandProvider publica inline `--brand-saved(-fg)` y compone
 * `--brand = var(--brand-preview, --brand-saved)`; BrandingForm escribe/borra
 * `--brand-preview(-fg)` en documentElement mientras se edita.
 *
 * Este fichero corre con happy-dom (docblock) para verificar la manipulacion
 * real del estilo del documento; el resto de la suite sigue en node.
 */

describe("buildBrandStyle (composicion de BrandProvider)", () => {
  it("publica el valor guardado y compone --brand desde la var de preview", () => {
    const style = buildBrandStyle("#0A7B5B");

    expect(style["--brand-saved"]).toBe("#0a7b5b");
    expect(style["--brand-fg-saved"]).toBe(pickBrandForeground("#0a7b5b"));
    expect(style["--brand"]).toBe("var(--brand-preview, var(--brand-saved))");
    expect(style["--brand-fg"]).toBe(
      "var(--brand-preview-fg, var(--brand-fg-saved))",
    );
  });

  it("usa el color por defecto si no hay agencia (super_admin sin impersonar)", () => {
    const style = buildBrandStyle(null);

    expect(style["--brand-saved"]).toBe("#2563eb");
  });
});

describe("applyBrandPreview / clearBrandPreview (DOM)", () => {
  beforeEach(() => clearBrandPreview());

  it("aplica las vars de preview normalizadas en documentElement", () => {
    applyBrandPreview("#0A7B5B");

    expect(
      document.documentElement.style.getPropertyValue(BRAND_PREVIEW_VAR),
    ).toBe("#0a7b5b");
    expect(
      document.documentElement.style.getPropertyValue(BRAND_PREVIEW_FG_VAR),
    ).toBe(pickBrandForeground("#0a7b5b"));
  });

  it.each([["rojo"], [""], ["javascript:alert(1)"], ["#12345"]])(
    "ignora colores invalidos (%j)",
    (bad) => {
      applyBrandPreview(bad);

      expect(
        document.documentElement.style.getPropertyValue(BRAND_PREVIEW_VAR),
      ).toBe("");
    },
  );

  it("clearBrandPreview elimina ambas variables del documento", () => {
    applyBrandPreview("#0a7b5b");

    clearBrandPreview();

    expect(
      document.documentElement.style.getPropertyValue(BRAND_PREVIEW_VAR),
    ).toBe("");
    expect(
      document.documentElement.style.getPropertyValue(BRAND_PREVIEW_FG_VAR),
    ).toBe("");
  });

  it("es seguro llamar a clear sin preview previa", () => {
    expect(() => clearBrandPreview()).not.toThrow();
  });
});
