import { describe, expect, it } from "vitest";

import {
  impersonationStartError,
  impersonationStopError,
  maestroAccessError,
  type MasterActor,
} from "@/lib/master-access";

/**
 * Matriz de guards puros del panel maestro (brief Task 17).
 * Decisiones documentadas:
 * - /maestro exige super_admin SIN impersonacion activa (evita confusion
 *   anidada; el banner permite salir y volver).
 * - impersonateStart solo super_admin; un inicio doble se rechaza con error
 *   claro (no auto-stop: la salida es una accion explicita y auditada).
 * - la agencia destino puede existir activa O desactivada (diagnostico/soporte;
 *   la visibilidad de lectura no cambia porque is_super_admin ya la permite).
 * - stop sin sesion de suplantacion activa devuelve error.
 */

const superAdmin: MasterActor = {
  userId: "u-super",
  role: "super_admin",
  activeAgencyId: null,
};

const target = { id: "a-1", active: true };

describe("maestroAccessError", () => {
  it.each(["agent", "admin"] as const)(
    "rechaza acceso al panel a rol %s",
    (role) => {
      expect(
        maestroAccessError({ userId: "u1", role, activeAgencyId: null }),
      ).toMatch(/superadministrador/);
    },
  );

  it("permite super_admin sin impersonacion", () => {
    expect(maestroAccessError(superAdmin)).toBeNull();
  });

  it("bloquea /maestro mientras se esta suplantando", () => {
    expect(
      maestroAccessError({ ...superAdmin, activeAgencyId: "a-1" }),
    ).toMatch(/suplantación|viendo/i);
  });
});

describe("impersonationStartError", () => {
  it.each(["agent", "admin"] as const)("rechaza iniciar a rol %s", (role) => {
    expect(
      impersonationStartError({ userId: "u1", role, activeAgencyId: null }, target),
    ).toMatch(/superadministrador/);
  });

  it("rechaza inicio doble (ya suplantando)", () => {
    expect(
      impersonationStartError(
        { ...superAdmin, activeAgencyId: "a-otra" },
        target,
      ),
    ).toMatch(/suplantación|sal primero/i);
  });

  it("rechaza agencia inexistente", () => {
    expect(impersonationStartError(superAdmin, null)).toMatch(/no existe/i);
  });

  it("permite destino activo y tambien desactivado (soporte)", () => {
    expect(impersonationStartError(superAdmin, target)).toBeNull();
    expect(
      impersonationStartError(superAdmin, { id: "a-2", active: false }),
    ).toBeNull();
  });
});

describe("impersonationStopError", () => {
  it.each(["agent", "admin"] as const)("rechaza parar a rol %s", (role) => {
    expect(
      impersonationStopError({ userId: "u1", role, activeAgencyId: "a-1" }),
    ).toMatch(/superadministrador/);
  });

  it("rechaza stop sin suplantacion activa", () => {
    expect(impersonationStopError(superAdmin)).toMatch(/ninguna agencia/i);
  });

  it("permite stop con suplantacion activa", () => {
    expect(
      impersonationStopError({ ...superAdmin, activeAgencyId: "a-1" }),
    ).toBeNull();
  });
});
