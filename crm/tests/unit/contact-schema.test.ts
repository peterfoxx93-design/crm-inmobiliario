import { describe, expect, it } from "vitest";

import { contactSchema } from "@/lib/validators/contact";

describe("contactSchema", () => {
  it("acepta un contacto valido", () => {
    const result = contactSchema.safeParse({
      full_name: "Luis García",
      contact_type: "comprador",
      phone: "+34 600 123 456",
      email: "luis@example.com",
      source: "web",
      consent_rgpd: true,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza nombre vacio y telefono corto", () => {
    const result = contactSchema.safeParse({
      full_name: "   ",
      contact_type: "comprador",
      phone: "12",
      source: "web",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza tipo/origen invalidos", () => {
    expect(
      contactSchema.safeParse({
        full_name: "Ana",
        contact_type: "dios",
        phone: "600123456",
        source: "web",
      }).success,
    ).toBe(false);

    expect(
      contactSchema.safeParse({
        full_name: "Ana",
        contact_type: "comprador",
        phone: "600123456",
        source: "ouija",
      }).success,
    ).toBe(false);
  });

  it("rechaza email malformado pero acepta vacio", () => {
    const bad = contactSchema.safeParse({
      full_name: "Ana",
      contact_type: "comprador",
      phone: "600123456",
      email: "no-es-email",
      source: "manual",
    });
    expect(bad.success).toBe(false);

    const empty = contactSchema.safeParse({
      full_name: "Ana",
      contact_type: "comprador",
      phone: "600123456",
      email: "",
      source: "manual",
    });
    expect(empty.success).toBe(true);
  });

  it("presupuesto debe ser positivo si aparece", () => {
    expect(
      contactSchema.safeParse({
        full_name: "Ana",
        contact_type: "comprador",
        phone: "600123456",
        source: "manual",
        budget_max: -5,
      }).success,
    ).toBe(false);
  });

  it("aplica defaults de status/consent/zonas", () => {
    const result = contactSchema.parse({
      full_name: "Ana",
      contact_type: "propietario",
      phone: "600123456",
      source: "referido",
    });
    expect(result.status).toBe("nuevo");
    expect(result.consent_rgpd).toBe(false);
    expect(result.preferred_zones).toEqual([]);
  });
});
