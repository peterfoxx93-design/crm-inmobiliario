import { describe, expect, it } from "vitest";

import { readBodyCapped } from "@/lib/request-body";

/**
 * El endpoint publico lee el cuerpo con cota dura de bytes (B2): nunca se
 * consume `request.json()` a ciegas, porque chunked encoding o una cabecera
 * content-length mentirosa lo burlarian.
 */

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("readBodyCapped", () => {
  it("acumula chunks y devuelve el texto completo", async () => {
    const result = await readBodyCapped(
      streamFrom(["{\"a\":", "123}"]),
      1_000,
    );
    expect(result).toEqual({ kind: "text", text: '{"a":123}' });
  });

  it("acepta un cuerpo exactamente en la cota", async () => {
    const text = "x".repeat(64);
    const result = await readBodyCapped(streamFrom([text]), 64);
    expect(result).toEqual({ kind: "text", text });
  });

  it("rechaza con too_large en cuanto se supera la cota (sin leerlo todo)", async () => {
    const result = await readBodyCapped(
      streamFrom(["y".repeat(100), "y".repeat(100)]),
      128,
    );
    expect(result).toEqual({ kind: "too_large" });
  });

  it("cuerpo nulo (GET/streaming ausente) -> invalid", async () => {
    const result = await readBodyCapped(null, 1_000);
    expect(result).toEqual({ kind: "invalid" });
  });

  it("stream que falla -> invalid (nunca lanza)", async () => {
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"parcial\""));
        controller.error(new Error("conexion cortada"));
      },
    });
    const result = await readBodyCapped(failing, 1_000);
    expect(result).toEqual({ kind: "invalid" });
  });
});
