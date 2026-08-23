/**
 * Validacion y helpers de ruta para las imagenes de propiedades (Task 10).
 * Modulo puro (sin I/O): lo usa el cliente como pre-chequeo amable y la
 * server action `uploadImage` como validacion autoritativa ANTES de subir
 * nada a Storage (enmienda controller: mimetype de imagen y tamano <= 5 MB).
 */

/** Maximo por imagen: 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Mimetypes aceptados para fotos de propiedades. Se acota a formatos web
 * habituales en lugar de cualquier `image/*` (endurecimiento basico).
 */
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * Devuelve un mensaje de error en espanol si el archivo no sirve como foto
 * de propiedad, o null si es valido.
 * Acepta `{type, size}` parciales para poder testear sin `File` real.
 */
export function validateImageFile(file: {
  type?: unknown;
  size?: unknown;
}): string | null {
  if (typeof file.type !== "string" || !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "El archivo no es una imagen válida (JPG, PNG, WEBP, GIF o AVIF).";
  }
  if (
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    return "El archivo está vacío o dañado.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "La imagen supera el máximo de 5 MB.";
  }
  return null;
}

/**
 * Sanitiza un nombre de archivo para usarlo como clave de Storage:
 * quita rutas, conserva solo [a-z0-9_.-], colapsa guiones y limita la
 * longitud conservando el final (la extension importa).
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const trimmed = cleaned.length > 80 ? cleaned.slice(-80) : cleaned;
  return trimmed || "imagen";
}

/**
 * Ruta de una imagen dentro del bucket publico `property-images`
 * (enmienda controller): {agency_id}/{propertyId}/{archivo}.
 * El agency_id SIEMPRE sale del perfil del actor en servidor, nunca del input.
 */
export function buildImagePath(
  agencyId: string,
  propertyId: string,
  fileName: string,
): string {
  return `${agencyId}/${propertyId}/${sanitizeFileName(fileName)}`;
}

/**
 * Extrae la ruta relativa al bucket desde una URL publica de Supabase
 * (`.../object/public/property-images/{ruta}`); null si la URL no pertenece
 * a ese bucket. La usa deleteImage para limpiar el objeto en Storage.
 */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = "/object/public/property-images/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length);
  return path ? decodeURIComponent(path) : null;
}
