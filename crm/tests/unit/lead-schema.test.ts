import { describe, expect, it } from "vitest";

import {
  decideLeadUpsert,
  isHoneypotFilled,
  publicLeadSchema,
} from "@/lib/validators/lead";

const validPayload = {
  fullName: "  Ana Lopez  ",
  phone: "+34 600 123 456",
  email: "ana@example.com",
  message: "Me interesa el piso de la calle Mayor",
};

describe("publicLeadSchema", () => {
  it("acepta un payload valido y recorta los textos", () => {
    const result = publicLeadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Ana Lopez");
      expect(result.data.phone).toBe("+34 600 123 456");
    }
  });

  it("acepta sin email ni mensaje (campos condicionales del formulario)", () => {
    expect(publicLeadSchema.safeParse({ fullName: "Luis", phone: "600123456" }).success).toBe(true);
    expect(
      publicLeadSchema.safeParse({ fullName: "Luis", phone: "600123456", email: "", message: "" })
        .success,
    ).toBe(true);
  });

  it("rechaza nombre vacio o demasiado largo", () => {
    expect(publicLeadSchema.safeParse({ ...validPayload, fullName: "   " }).success).toBe(false);
    expect(publicLeadSchema.safeParse({ ...validPayload, fullName: "x".repeat(121) }).success).toBe(false);
  });

  it("rechaza telefonos cortos, largos o con caracteres invalidos", () => {
    expect(publicLeadSchema.safeParse({ ...validPayload, phone: "12" }).success).toBe(false);
    expect(publicLeadSchema.safeParse({ ...validPayload, phone: `${"6".repeat(33)}` }).success).toBe(false);
    expect(publicLeadSchema.safeParse({ ...validPayload, phone: "abc;DROP" }).success).toBe(false);
    // Formatos internacionales flexibles aceptados
    expect(publicLeadSchema.safeParse({ ...validPayload, phone: "+34-600-123-456" }).success).toBe(true);
    expect(publicLeadSchema.safeParse({ ...validPayload, phone: "(+34) 911 22 33 44" }).success).toBe(true);
  });

  it("rechaza email malformado o demasiado largo", () => {
    expect(publicLeadSchema.safeParse({ ...validPayload, email: "no-es-email" }).success).toBe(false);
    expect(publicLeadSchema.safeParse({ ...validPayload, email: `a@${"b".repeat(160)}.com` }).success)
      .toBe(false);
  });

  it("rechaza mensajes que superan el maximo", () => {
    expect(publicLeadSchema.safeParse({ ...validPayload, message: "m".repeat(2001) }).success).toBe(false);
  });

  it("es estricto: rechaza claves desconocidas", () => {
    expect(
      publicLeadSchema.safeParse({ ...validPayload, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("isHoneypotFilled", () => {
  it("devuelve false cuando el campo trampa llega vacio (humano legitimo)", () => {
    expect(isHoneypotFilled(undefined)).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled("")).toBe(false);
    expect(isHoneypotFilled("   ")).toBe(false);
  });

  it("devuelve true cuando el campo trampa viene relleno (bot)", () => {
    expect(isHoneypotFilled("http://spam.example")).toBe(true);
    expect(isHoneypotFilled(" x ")).toBe(true);
  });
});

describe("decideLeadUpsert", () => {
  const agencyId = "00000000-0000-0000-0000-000000000001";
  const nowIso = "2026-08-23T10:00:00.000Z";
  // Contrato: recibe la SALIDA del schema (el route siempre parsea antes).
  const parsedLead = publicLeadSchema.parse(validPayload);

  it("contacto nuevo -> insert con source web y consentimiento RGPD sellado", () => {
    const decision = decideLeadUpsert(null, agencyId, parsedLead, nowIso);
    expect(decision.kind).toBe("nuevo");
    if (decision.kind === "nuevo") {
      expect(decision.contact).toMatchObject({
        agency_id: agencyId,
        full_name: "Ana Lopez",
        phone: "+34 600 123 456",
        email: "ana@example.com",
        notes: "Me interesa el piso de la calle Mayor",
        source: "web",
        consent_rgpd: true,
        consent_at: nowIso,
      });
    }
  });

  it("contacto existente -> actividad de sistema con el mensaje", () => {
    const decision = decideLeadUpsert(
      "11111111-1111-1111-1111-111111111111",
      agencyId,
      parsedLead,
      nowIso,
    );
    expect(decision.kind).toBe("existente");
    if (decision.kind === "existente") {
      expect(decision.activity.type).toBe("sistema");
      expect(decision.activity.body).toContain("Me interesa el piso de la calle Mayor");
    }
  });

  it("email vacio se normaliza a null y sin mensaje no rompe la decision", () => {
    const decision = decideLeadUpsert(
      null,
      agencyId,
      { fullName: "Luis", phone: "600123456", email: "", message: "" },
      nowIso,
    );
    expect(decision.kind).toBe("nuevo");
    if (decision.kind === "nuevo") {
      expect(decision.contact.email).toBeNull();
      expect(decision.contact.notes).toBeNull();
    }
  });
});
