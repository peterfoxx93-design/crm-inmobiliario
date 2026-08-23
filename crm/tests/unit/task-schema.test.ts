import { describe, expect, it } from "vitest";

import {
  rescheduleTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/lib/validators/task";

describe("taskIdSchema", () => {
  it("acepta uuids y rechaza el resto", () => {
    expect(taskIdSchema.safeParse("3f2504e0-4f89-11d3-9a0c-0305e82c3301").success)
      .toBe(true);
    expect(taskIdSchema.safeParse("no-es-uuid").success).toBe(false);
  });
});

describe("rescheduleTaskSchema", () => {
  it("acepta ISO completo con Z", () => {
    expect(
      rescheduleTaskSchema.parse({ dueDate: "2026-08-23T13:30:00.000Z" }).dueDate,
    ).toBe("2026-08-23T13:30:00.000Z");
  });

  it("rechaza cadenas no parseables o vacias", () => {
    expect(rescheduleTaskSchema.safeParse({ dueDate: "no-es-fecha" }).success).toBe(false);
    expect(rescheduleTaskSchema.safeParse({ dueDate: "" }).success).toBe(false);
    expect(rescheduleTaskSchema.safeParse({}).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("parcial: objeto vacio no toca ningun campo", () => {
    expect(updateTaskSchema.parse({})).toEqual({});
  });

  it("recorta titulo y notas y valida longitudes", () => {
    const out = updateTaskSchema.parse({ title: "  Llamar a Juan  ", notes: " x " });
    expect(out.title).toBe("Llamar a Juan");
    expect(out.notes).toBe("x");
    expect(updateTaskSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ notes: "x".repeat(4001) }).success).toBe(false);
  });

  it("contactId: undefined = no tocar; null = limpiar; uuid obligatorio", () => {
    expect(updateTaskSchema.parse({}).contactId).toBeUndefined();
    expect(updateTaskSchema.parse({ contactId: null }).contactId).toBeNull();
    expect(
      updateTaskSchema.safeParse({
        contactId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      }).success,
    ).toBe(true);
    expect(updateTaskSchema.safeParse({ contactId: "abc" }).success).toBe(false);
  });

  it("propertyId: mismas reglas null|undefined|uuid", () => {
    expect(updateTaskSchema.parse({ propertyId: null }).propertyId).toBeNull();
    expect(updateTaskSchema.parse({}).propertyId).toBeUndefined();
    expect(updateTaskSchema.safeParse({ propertyId: "abc" }).success).toBe(false);
  });

  it("dueDate acepta ISO parseable", () => {
    expect(
      updateTaskSchema.parse({ dueDate: "2026-09-01T08:00:00.000Z" }).dueDate,
    ).toBe("2026-09-01T08:00:00.000Z");
    expect(updateTaskSchema.safeParse({ dueDate: "mañana" }).success).toBe(false);
  });
});
