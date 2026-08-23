/**
 * Lectura de cuerpo HTTP con cota dura de bytes (review B2, Task 18).
 *
 * Por que no `request.json()` a secas: esa llamada consume el cuerpo COMPLETO
 * antes de parsear; una cabecera content-length mentirosa o chunked encoding
 * burlarian cualquier comprobacion previa del header. Aqui se lee el stream
 * por chunks y se corta en cuanto se supera la cota: un atacante no puede
 * hacer que el servidor bufferice megas ilimitadas.
 *
 * Sin dependencias de Next: solo Web Streams (node >= 18), testeable en
 * vitest con ReadableStream reales.
 */

export type CappedReadResult =
  | { kind: "text"; text: string }
  | { kind: "too_large" }
  | { kind: "invalid" };

/**
 * Lee el stream hasta `maxBytes`. Resultados:
 * - text: cuerpo completo dentro de la cota.
 * - too_large: se supero la cota (se abandona la lectura inmediatamente).
 * - invalid: sin cuerpo o error de lectura (conexion cortada, etc.).
 */
export async function readBodyCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<CappedReadResult> {
  if (!body) {
    return { kind: "invalid" };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        return { kind: "too_large" };
      }
      text += decoder.decode(value, { stream: true });
    }
    return { kind: "text", text: text + decoder.decode() };
  } catch {
    // Cuerpo interrumpido / stream corrupto: invalid, nunca lanza.
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }
}
