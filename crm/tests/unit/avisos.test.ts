import { describe, expect, it } from "vitest";

import { filtrarLeadsSinActividadReciente } from "@/lib/avisos";

const lead = (id: string) => ({ id, full_name: `Lead ${id}` });

describe("filtrarLeadsSinActividadReciente", () => {
  it("excluye los leads cuyo id tiene actividad registrada", () => {
    const leads = [lead("a"), lead("b"), lead("c")];
    const conActividad = new Set(["b"]);

    expect(filtrarLeadsSinActividadReciente(leads, conActividad)).toEqual([
      lead("a"),
      lead("c"),
    ]);
  });

  it("devuelve todos los leads cuando nadie tiene actividad", () => {
    const leads = [lead("a"), lead("b")];

    expect(filtrarLeadsSinActividadReciente(leads, new Set())).toEqual(leads);
  });

  it("excluye varios leads y conserva el orden original", () => {
    const leads = [lead("a"), lead("b"), lead("c"), lead("d")];
    const conActividad = new Set(["a", "d"]);

    expect(filtrarLeadsSinActividadReciente(leads, conActividad)).toEqual([
      lead("b"),
      lead("c"),
    ]);
  });

  it("ignora contact_id nulos en el conjunto de actividad", () => {
    const leads = [lead("a")];
    // Set construido desde filas de activities: los null se descartan antes.
    const conActividad = new Set(
      ["a", null].filter((id): id is string => id !== null),
    );

    expect(filtrarLeadsSinActividadReciente(leads, conActividad)).toEqual([]);
  });
});
