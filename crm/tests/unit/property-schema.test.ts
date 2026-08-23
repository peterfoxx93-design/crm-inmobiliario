import { describe, expect, it } from "vitest";

import { FEATURES_LIST } from "@/lib/constants";
import { propertySchema, propertyStatusSchema } from "@/lib/validators/property";

/**
 * Task 10 (enmienda controller): esquema EXACTO de la ficha de propiedad.
 * title >= 5, city obligatoria (DDL NOT NULL), price > 0, enums cerrados,
 * enteros >= 0 opcionales y features acotadas a FEATURES_LIST.
 */

const VALID_BASE = {
  title: "Piso luminoso en el centro",
  operation: "venta",
  property_type: "piso",
  price: 250000,
  city: "Madrid",
};

describe("propertySchema", () => {
  it("acepta un minimo valido sin campos opcionales", () => {
    const result = propertySchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it("rellena features con [] por defecto", () => {
    const result = propertySchema.parse(VALID_BASE);
    expect(result.features).toEqual([]);
  });

  it("recorta espacios del titulo y la ciudad", () => {
    const result = propertySchema.parse({
      ...VALID_BASE,
      title: "  Piso luminoso y exterior  ",
      city: "  Madrid  ",
    });
    expect(result.title).toBe("Piso luminoso y exterior");
    expect(result.city).toBe("Madrid");
  });

  it.each(["casa", "1234", "     ", "", undefined])(
    "rechaza titulos con menos de 5 caracteres (%j)",
    (title) => {
      const result = propertySchema.safeParse({ ...VALID_BASE, title });
      expect(result.success).toBe(false);
    },
  );

  it.each([null, 42, ["Madrid"]])(
    "rechaza ciudades ausentes o con tipo invalido (%j)",
    (city) => {
      const result = propertySchema.safeParse({ ...VALID_BASE, city });
      expect(result.success).toBe(false);
    },
  );

  it.each([0, -1, -0.01, "abc", undefined])(
    "rechaza precios <= 0 o no numericos (%j)",
    (price) => {
      const result = propertySchema.safeParse({ ...VALID_BASE, price });
      expect(result.success).toBe(false);
    },
  );

  it("acepta precios decimales positivos", () => {
    const result = propertySchema.safeParse({
      ...VALID_BASE,
      price: 850.5,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza operation fuera del enum", () => {
    const result = propertySchema.safeParse({ ...VALID_BASE, operation: "traspaso" });
    expect(result.success).toBe(false);
  });

  it("rechaza property_type fuera del enum", () => {
    const result = propertySchema.safeParse({
      ...VALID_BASE,
      property_type: "castillo",
    });
    expect(result.success).toBe(false);
  });

  it.each([-1, 1.5, "dos"])("rechaza bedrooms invalidos (%j)", (bedrooms) => {
    const result = propertySchema.safeParse({ ...VALID_BASE, bedrooms });
    expect(result.success).toBe(false);
  });

  it("acepta bedrooms/bathrooms 0 (estudios)", () => {
    const result = propertySchema.safeParse({
      ...VALID_BASE,
      bedrooms: 0,
      bathrooms: 0,
    });
    expect(result.success).toBe(true);
  });

  it("convierte vacios (NaN y '') en undefined para los opcionales", () => {
    const result = propertySchema.parse({
      ...VALID_BASE,
      bedrooms: Number.NaN, // inputs numericos vacios con valueAsNumber
      address: "",
      description: "",
      lat: Number.NaN,
      lng: Number.NaN,
    });
    expect(result.bedrooms).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });

  it("rechaza lat/lng fuera de rango geografico", () => {
    expect(propertySchema.safeParse({ ...VALID_BASE, lat: 91 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...VALID_BASE, lng: -181 }).success).toBe(false);
  });

  it("acepta lat/lng validos", () => {
    const result = propertySchema.safeParse({ ...VALID_BASE, lat: 40.4168, lng: -3.7038 });
    expect(result.success).toBe(true);
  });

  it("rechaza features fuera del catalogo FEATURES_LIST", () => {
    const result = propertySchema.safeParse({
      ...VALID_BASE,
      features: ["piscina", "wifi"],
    });
    expect(result.success).toBe(false);
  });

  it("deduplica features conservando el orden", () => {
    const result = propertySchema.parse({
      ...VALID_BASE,
      features: ["garaje", "piscina", "garaje"],
    });
    expect(result.features).toEqual(["garaje", "piscina"]);
  });

  it("acepta todas las features del catalogo", () => {
    const allIds = FEATURES_LIST.map((feature) => feature.id);
    const result = propertySchema.safeParse({
      ...VALID_BASE,
      features: allIds,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza surface_m2 <= 0", () => {
    expect(propertySchema.safeParse({ ...VALID_BASE, surface_m2: 0 }).success).toBe(false);
    expect(propertySchema.safeParse({ ...VALID_BASE, surface_m2: -10 }).success).toBe(false);
  });
});

describe("propertyStatusSchema", () => {
  it.each(["borrador", "activo", "reservado", "vendido", "retirado"])(
    "acepta el estado %s",
    (status) => {
      expect(propertyStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(["pausado", "ACTIVO", "", undefined, null, 42])(
    "rechaza estados invalidos (%j)",
    (status) => {
      expect(propertyStatusSchema.safeParse(status).success).toBe(false);
    },
  );
});
