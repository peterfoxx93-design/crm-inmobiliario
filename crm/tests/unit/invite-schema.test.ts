import { describe, expect, it } from "vitest";

import { inviteSchema } from "@/lib/validators/user";

/**
 * Brief Task 6 (Step 1): esquema zod de invitaciones.
 * - email válido requerido;
 * - fullName requerido;
 * - role SOLO "admin" | "agent" para invitaciones de agencia
 *   ("super_admin" nunca es asignable desde la UI de Ajustes);
 * - el email se normaliza (trim + minúsculas) antes de crear el usuario Auth.
 */
describe("inviteSchema", () => {
  it("acepta una invitación válida", () => {
    const result = inviteSchema.safeParse({
      email: "agente@agencia.com",
      role: "agent",
      fullName: "Ana García",
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["dios"], // rol inexistente (ejemplo del brief)
    ["super_admin"], // nunca asignable al invitar miembros de agencia
    [""], // vacío
    ["ADMIN"], // solo minúsculas exactas
    ["Agent"], // solo minúsculas exactas
    [undefined],
    [null],
    [42],
  ])("rechaza rol inválido (%j)", (role) => {
    const result = inviteSchema.safeParse({
      email: "a@b.c",
      role,
      fullName: "X",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["sin-arroba"],
    ["a@b"], // dominio sin TLD
    ["@dominio.com"], // sin parte local
    ["a b@dominio.com"], // espacio interior
    [""], // vacío tras trim
    [undefined],
    [null],
    [42],
  ])("rechaza email inválido (%j)", (email) => {
    const result = inviteSchema.safeParse({
      email,
      role: "agent",
      fullName: "X",
    });

    expect(result.success).toBe(false);
  });

  it.each([[""], ["   "], [undefined], [null], [42]])(
    "rechaza fullName ausente o en blanco (%j)",
    (fullName) => {
      const result = inviteSchema.safeParse({
        email: "agente@agencia.com",
        role: "agent",
        fullName,
      });

      expect(result.success).toBe(false);
    },
  );

  it("normaliza el email (trim + minúsculas)", () => {
    const result = inviteSchema.parse({
      email: "  Agente@Agencia.COM ",
      role: "admin",
      fullName: "  Ana García  ",
    });

    // fullName se recorta; el trigger handle_new_user lo guarda tal cual.
    expect(result).toEqual({
      email: "agente@agencia.com",
      role: "admin",
      fullName: "Ana García",
    });
  });
});
