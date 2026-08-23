import { describe, expect, it } from "vitest";

import {
  closeDealSchema,
  updateDealSchema,
} from "@/lib/validators/deal";

describe("updateDealSchema", () => {
  it("coacciona el importe en string del input a numero", () => {
    const result = updateDealSchema.parse({ value: "250000" });
    expect(result.value).toBe(250000);
  });

  it("string vacio limpia el importe (null)", () => {
    expect(updateDealSchema.parse({ value: "" }).value).toBeNull();
    expect(updateDealSchema.parse({ value: null }).value).toBeNull();
  });

  it("undefined = no tocar el campo", () => {
    expect(updateDealSchema.parse({}).value).toBeUndefined();
    expect(updateDealSchema.parse({ value: undefined }).value).toBeUndefined();
  });

  it("rechaza importes no numericos o no positivos", () => {
    expect(updateDealSchema.safeParse({ value: "abc" }).success).toBe(false);
    expect(updateDealSchema.safeParse({ value: "-5" }).success).toBe(false);
    expect(updateDealSchema.safeParse({ value: "0" }).success).toBe(false);
  });

  it("recorta notas y valida longitud", () => {
    expect(updateDealSchema.parse({ notes: "  hola  " }).notes).toBe("hola");
    expect(
      updateDealSchema.safeParse({ notes: "x".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("closeDealSchema", () => {
  it("exige motivo en perdida y lo recorta", () => {
    const lost = closeDealSchema.safeParse({ won: false, lostReason: "  precio  " });
    expect(lost.success).toBe(true);
    if (lost.success) expect(lost.data.lostReason).toBe("precio");

    expect(closeDealSchema.safeParse({ won: false }).success).toBe(false);
    expect(closeDealSchema.safeParse({ won: true }).success).toBe(true);
  });

  it("rechaza motivos demasiado largos", () => {
    expect(
      closeDealSchema.safeParse({ won: false, lostReason: "x".repeat(501) })
        .success,
    ).toBe(false);
  });
});
