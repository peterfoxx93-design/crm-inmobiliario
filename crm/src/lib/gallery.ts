/**
 * Logica pura del orden de la galeria de imagenes (Task 10).
 * La comparten la UI (reorden optimista en GalleryManager) y la server
 * action `reorderImages` (persistencia), para que ambas calculen
 * exactamente las mismas posiciones.
 */

/** Fila de actualizacion de posicion para property_images. */
export interface ImagePositionUpdate {
  id: string;
  /** Posicion 1-based (la UI y las queries ordenan por este campo). */
  position: number;
}

/**
 * Asigna posiciones 1-based segun el orden dado.
 * Es total y determinista: cualquier permutacion produce posiciones
 * consecutivas sin huecos, aunque la entrada traiga duplicados.
 */
export function computePositions(ids: string[]): ImagePositionUpdate[] {
  return ids.map((id, index) => ({ id, position: index + 1 }));
}
