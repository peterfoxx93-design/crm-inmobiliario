import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_BYTES,
  buildImagePath,
  sanitizeFileName,
  storagePathFromPublicUrl,
  validateImageFile,
} from "@/lib/image-upload";

/**
 * Task 10 (enmienda controller): la subida valida mimetype de imagen y
 * tamano <= 5 MB ANTES de tocar Storage. Helpers puros compartidos por
 * cliente (pre-chequeo) y server action `uploadImage` (autoritativo).
 */
describe("validateImageFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"])(
    "acepta el mimetype de imagen %s",
    (type) => {
      expect(validateImageFile({ type, size: 1024 })).toBeNull();
    },
  );

  it.each([
    "application/pdf",
    "video/mp4",
    "text/plain",
    "",
    undefined,
    "IMAGE/PNG", // los mimetypes van en minusculas
  ])("rechaza el mimetype %j", (type) => {
    const result = validateImageFile({ type, size: 1024 });
    expect(result).toMatch(/no es una imagen válida/);
  });

  it("rechaza archivos vacios", () => {
    const result = validateImageFile({ type: "image/jpeg", size: 0 });
    expect(result).toMatch(/vacío o dañado/);
  });

  it("rechaza tamaños no numericos", () => {
    expect(validateImageFile({ type: "image/jpeg", size: "1024" })).not.toBeNull();
    expect(validateImageFile({ type: "image/jpeg" })).not.toBeNull();
  });

  it("acepta exactamente 5 MB", () => {
    expect(validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES })).toBeNull();
  });

  it("rechaza mas de 5 MB", () => {
    const result = validateImageFile({
      type: "image/png",
      size: MAX_IMAGE_BYTES + 1,
    });
    expect(result).toMatch(/5 MB/);
  });
});

describe("sanitizeFileName", () => {
  it("elimina rutas del nombre", () => {
    expect(sanitizeFileName("..\\..\\foto.jpg")).toBe("foto.jpg");
    expect(sanitizeFileName("/tmp/foto.jpg")).toBe("foto.jpg");
  });

  it("normaliza espacios y caracteres especiales a guiones", () => {
    expect(sanitizeFileName("Mi Foto (1).JPG")).toBe("mi-foto-1-.jpg");
  });

  it("devuelve un fallback para nombres vacios o invalidos", () => {
    expect(sanitizeFileName("")).toBe("imagen");
    expect(sanitizeFileName("///")).toBe("imagen");
  });

  it("limita la longitud conservando el final (la extension)", () => {
    const long = `${"a".repeat(120)}.jpg`;
    const result = sanitizeFileName(long);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith(".jpg")).toBe(true);
  });
});

describe("buildImagePath", () => {
  it("compone {agency_id}/{propertyId}/{archivo}", () => {
    expect(buildImagePath("agency-uuid", "prop-uuid", "Mi Foto.JPG")).toBe(
      "agency-uuid/prop-uuid/mi-foto.jpg",
    );
  });
});

describe("storagePathFromPublicUrl", () => {
  const BASE = "https://xyz.supabase.co/storage/v1/object/public";

  it("extrae la ruta relativa al bucket property-images", () => {
    expect(
      storagePathFromPublicUrl(`${BASE}/property-images/ag-1/p-2/foto.jpg`),
    ).toBe("ag-1/p-2/foto.jpg");
  });

  it("decodifica caracteres URL-encoded", () => {
    expect(
      storagePathFromPublicUrl(`${BASE}/property-images/ag-1/p-2/mi%20foto.jpg`),
    ).toBe("ag-1/p-2/mi foto.jpg");
  });

  it("devuelve null para URLs de otro bucket o ajenas", () => {
    expect(storagePathFromPublicUrl(`${BASE}/branding/logo.png`)).toBeNull();
    expect(storagePathFromPublicUrl("https://ejemplo.com/foto.jpg")).toBeNull();
  });

  it("devuelve null si tras el marcador no hay ruta", () => {
    expect(storagePathFromPublicUrl(`${BASE}/property-images/`)).toBeNull();
  });
});
