import { describe, expect, it } from "vitest";

import {
  isAdminRole,
  memberManagementError,
  type ActorContext,
  type MemberTarget,
} from "@/lib/settings-access";

/**
 * Brief Task 16: guard puro de la gestion de miembros en Ajustes.
 * Reglas (en este orden):
 *  1. Solo admin/super_admin gestiona usuarios.
 *  2. Nunca sobre la propia cuenta (auto-baneo).
 *  3. Nunca sobre una cuenta super_admin.
 *  4. Solo miembros de la MISMA agencia (impersonacion incluida).
 */

const adminActor: ActorContext = {
  userId: "u-admin",
  role: "admin",
  agencyId: "a-1",
};

const superAdminActor: ActorContext = {
  userId: "u-super",
  role: "super_admin",
  agencyId: "a-1", // impersonando a-1
};

const agentMember: MemberTarget = { id: "u-1", role: "agent", agencyId: "a-1" };

describe("isAdminRole", () => {
  it.each(["admin", "super_admin"] as const)(
    "acepta %j como rol de administracion",
    (role) => {
      expect(isAdminRole(role)).toBe(true);
    },
  );

  it("rechaza agent como rol de administracion", () => {
    expect(isAdminRole("agent")).toBe(false);
  });
});

describe("memberManagementError", () => {
  it("permite a un admin desactivar/reactivar a un miembro de su agencia", () => {
    expect(memberManagementError(adminActor, agentMember)).toBeNull();
  });

  it("permite a un super_admin impersonando gestionar miembros de la agencia", () => {
    expect(memberManagementError(superAdminActor, agentMember)).toBeNull();
  });

  it("bloquea a un agent aunque apunte a otro miembro", () => {
    const error = memberManagementError(
      { userId: "u-agent", role: "agent", agencyId: "a-1" },
      agentMember,
    );

    expect(error).toBe("Solo un administrador puede gestionar usuarios.");
  });

  it("nunca permite desactivar la propia cuenta (ni siendo super_admin)", () => {
    const self: MemberTarget = {
      id: "u-super",
      role: "super_admin",
      agencyId: null,
    };

    expect(memberManagementError(superAdminActor, self)).toBe(
      "No puedes desactivar tu propia cuenta.",
    );
    expect(
      memberManagementError(adminActor, {
        ...adminActor,
        role: "admin",
        agencyId: "a-1",
        id: "u-admin",
      }),
    ).toBe("No puedes desactivar tu propia cuenta.");
  });

  it("nunca permite gestionar una cuenta super_admin", () => {
    const otherSuper: MemberTarget = {
      id: "u-otro-super",
      role: "super_admin",
      agencyId: null,
    };

    expect(memberManagementError(adminActor, otherSuper)).toBe(
      "No puedes gestionar una cuenta de superadministrador.",
    );
    expect(memberManagementError(superAdminActor, otherSuper)).toBe(
      "No puedes gestionar una cuenta de superadministrador.",
    );
  });

  it("bloquea miembros de otra agencia", () => {
    const outsider: MemberTarget = {
      id: "u-2",
      role: "agent",
      agencyId: "a-2",
    };
    const impersonatingOther: ActorContext = {
      userId: "u-super",
      role: "super_admin",
      agencyId: "a-9",
    };

    expect(memberManagementError(adminActor, outsider)).toBe(
      "El usuario no pertenece a tu agencia.",
    );
    expect(memberManagementError(impersonatingOther, outsider)).toBe(
      "El usuario no pertenece a tu agencia.",
    );
  });

  it("bloquea si el actor no tiene agencia activa (super_admin sin impersonar)", () => {
    const noAgencySuper: ActorContext = {
      userId: "u-super",
      role: "super_admin",
      agencyId: null,
    };

    expect(memberManagementError(noAgencySuper, agentMember)).toBe(
      "El usuario no pertenece a tu agencia.",
    );
  });
});
