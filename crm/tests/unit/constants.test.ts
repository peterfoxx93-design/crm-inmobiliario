import { describe, expect, it } from "vitest";

import {
  ACTIVITY_TYPE_META,
  CONTACT_STATUS_META,
  DEAL_STAGES,
  FEATURES_LIST,
  OPERATION_LABELS,
  PROPERTY_STATUS_META,
  PROPERTY_TYPES,
} from "@/lib/constants";
import type {
  ActivityType,
  ContactStatus,
  DealStage,
  PropertyStatus,
} from "@/lib/types";

describe("DEAL_STAGES", () => {
  it("define las 5 etapas del pipeline en orden", () => {
    expect(DEAL_STAGES.map((s) => s.id)).toEqual([
      "nuevo_lead",
      "calificado",
      "visita",
      "negociacion",
      "cierre",
    ]);
  });

  it("tiene labels en espanol", () => {
    expect(DEAL_STAGES.map((s) => s.label)).toEqual([
      "Nuevo lead",
      "Calificado",
      "Visita",
      "Negociación",
      "Cierre",
    ]);
  });
});

describe("PROPERTY_STATUS_META", () => {
  it("cubre todos los estados con label y color", () => {
    const statuses: PropertyStatus[] = [
      "borrador",
      "activo",
      "reservado",
      "vendido",
      "retirado",
    ];
    for (const status of statuses) {
      expect(PROPERTY_STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(PROPERTY_STATUS_META[status].color.length).toBeGreaterThan(0);
    }
  });

  it("usa la paleta operativa (gris/verde/ambar/azul/rojo)", () => {
    expect(PROPERTY_STATUS_META.borrador.color).toContain("gray");
    expect(PROPERTY_STATUS_META.activo.color).toContain("green");
    expect(PROPERTY_STATUS_META.reservado.color).toContain("amber");
    expect(PROPERTY_STATUS_META.vendido.color).toContain("blue");
    expect(PROPERTY_STATUS_META.retirado.color).toContain("red");
  });

  it("tiene labels en espanol", () => {
    expect(PROPERTY_STATUS_META.borrador.label).toBe("Borrador");
    expect(PROPERTY_STATUS_META.activo.label).toBe("Activo");
    expect(PROPERTY_STATUS_META.reservado.label).toBe("Reservado");
    expect(PROPERTY_STATUS_META.vendido.label).toBe("Vendido");
    expect(PROPERTY_STATUS_META.retirado.label).toBe("Retirado");
  });
});

describe("CONTACT_STATUS_META", () => {
  it("cubre todos los estados de contacto", () => {
    const statuses: ContactStatus[] = [
      "nuevo",
      "en_seguimiento",
      "calificado",
      "descartado",
      "cerrado",
    ];
    for (const status of statuses) {
      expect(CONTACT_STATUS_META[status].label.length).toBeGreaterThan(0);
      expect(CONTACT_STATUS_META[status].color.length).toBeGreaterThan(0);
    }
  });

  it("tiene labels en espanol", () => {
    expect(CONTACT_STATUS_META.nuevo.label).toBe("Nuevo");
    expect(CONTACT_STATUS_META.en_seguimiento.label).toBe("En seguimiento");
    expect(CONTACT_STATUS_META.calificado.label).toBe("Calificado");
    expect(CONTACT_STATUS_META.descartado.label).toBe("Descartado");
    expect(CONTACT_STATUS_META.cerrado.label).toBe("Cerrado");
  });
});

describe("OPERATION_LABELS", () => {
  it("etiqueta venta y alquiler", () => {
    expect(OPERATION_LABELS.venta).toBe("Venta");
    expect(OPERATION_LABELS.alquiler).toBe("Alquiler");
  });
});

describe("PROPERTY_TYPES", () => {
  it("incluye los 7 tipos del esquema", () => {
    expect(PROPERTY_TYPES.map((t) => t.id)).toEqual([
      "piso",
      "casa",
      "villa",
      "terreno",
      "local",
      "oficina",
      "otro",
    ]);
  });
});

describe("FEATURES_LIST", () => {
  it("incluye las caracteristicas esperadas", () => {
    expect(FEATURES_LIST.map((f) => f.id)).toEqual([
      "piscina",
      "garaje",
      "terraza",
      "ascensor",
      "aire",
      "jardin",
      "trastero",
    ]);
    expect(FEATURES_LIST.every((f) => f.label.length > 0)).toBe(true);
  });
});

describe("ACTIVITY_TYPE_META", () => {
  it("cubre todos los tipos de actividad con icono", () => {
    const types: ActivityType[] = [
      "llamada",
      "email",
      "whatsapp",
      "nota",
      "visita",
      "tarea",
      "sistema",
    ];
    for (const type of types) {
      expect(ACTIVITY_TYPE_META[type].label.length).toBeGreaterThan(0);
      expect(ACTIVITY_TYPE_META[type].icon.length).toBeGreaterThan(0);
    }
  });
});

describe("cobertura exhaustiva de etapas", () => {
  it("los ids de DEAL_STAGES coinciden con el tipo DealStage", () => {
    const ids: DealStage[] = DEAL_STAGES.map((s) => s.id);
    expect(ids).toHaveLength(5);
  });
});
