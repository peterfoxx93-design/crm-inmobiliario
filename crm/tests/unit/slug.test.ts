import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";

/**
 * Brief Task 17: slug automatico a partir del nombre de la agencia.
 * Convenciones: minusculas, sin acentes/enes, separador "-", sin guiones
 * sobrantes; vacio si no queda nada util (la accion genera fallback).
 */

describe("slugify", () => {
  it.each([
    ["Inmobiliaria Sur", "inmobiliaria-sur"],
    ["Fincas 24", "fincas-24"], // conserva numeros
    ["Inmobiliaria del Mar Menor", "inmobiliaria-del-mar-menor"],
    ["España & Cía", "espana-cia"], // ñ -> n, simbolos fuera
    ["  ÁGUILA   Real  ", "aguila-real"], // recorte + colapso de espacios
    ["café/bar", "cafe-bar"], // barra como separador
    ["---Hola---", "hola"], // guiones sobrantes recortados
    ["ya-tiene-slug", "ya-tiene-slug"],
  ])("convierte %j -> %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("devuelve cadena vacia si no hay caracteres utiles", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("??? &&&")).toBe("");
  });

  it("limita el slug a 60 caracteres sin guion final", () => {
    const long = slugify(
      "Inmobiliaria con un nombre extraordinariamente largo para probar el limite",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });
});
