import { describe, expect, it } from "vitest";

import {
  AGENCY_SLUG_STORAGE_KEY,
  resolvePostLoginPath,
  sanitizeNextPath,
} from "@/lib/auth";

/**
 * O1 (enmienda controller): el parámetro `next` tras login debe validarse
 * contra open-redirect. Solo se aceptan rutas relativas que empiecen por "/"
 * y NO empiecen por "//". Cualquier otra cosa -> "/".
 */
describe("sanitizeNextPath", () => {
  it.each([
    [undefined],
    [null],
    [""],
    ["   "],
    // Open-redirects clásicos:
    ["//evil.com"],
    ["///evil.com"],
    ["https://evil.com"],
    ["http://evil.com/ruta"],
    ["javascript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["\\evil.com"],
  ])("rechaza %j y devuelve '/'", (input) => {
    expect(sanitizeNextPath(input)).toBe("/");
  });

  it("acepta una ruta relativa simple", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("preserva query y hash de la ruta interna", () => {
    expect(sanitizeNextPath("/propiedades?status=activo#lista")).toBe(
      "/propiedades?status=activo#lista",
    );
  });

  it("acepta rutas internas con encoding (siguen siendo misma-origen)", () => {
    expect(sanitizeNextPath("/a%2fb")).toBe("/a%2fb");
  });

  it("acepta /login como destino (re-login explícito)", () => {
    expect(sanitizeNextPath("/login")).toBe("/login");
  });

  it("no acepta rutas que empiezan con espacio o texto suelto", () => {
    expect(sanitizeNextPath(" dashboard")).toBe("/");
    expect(sanitizeNextPath("dashboard")).toBe("/");
  });
});

describe("AGENCY_SLUG_STORAGE_KEY", () => {
  it("usa la clave 'agency_slug' definida en el brief", () => {
    expect(AGENCY_SLUG_STORAGE_KEY).toBe("agency_slug");
  });
});

/**
 * Brief Task 5 (Step 3): sin `next` el destino es /dashboard.
 * O1 (enmienda controller): con `next` invalido, "/".
 */
describe("resolvePostLoginPath", () => {
  it.each([[undefined], [null], [""]])(
    "sin next (%j) devuelve /dashboard",
    (input) => {
      expect(resolvePostLoginPath(input)).toBe("/dashboard");
    },
  );

  it.each([["//evil.com"], ["https://evil.com"], ["javascript:alert(1)"]])(
    "con next invalido (%j) devuelve '/'",
    (input) => {
      expect(resolvePostLoginPath(input)).toBe("/");
    },
  );

  it("con next valido devuelve la ruta intacta", () => {
    expect(resolvePostLoginPath("/propiedades?tab=agenda")).toBe(
      "/propiedades?tab=agenda",
    );
  });
});
