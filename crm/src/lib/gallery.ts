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

/**
 * Estrategia de escritura del reorder en DOS fases.
 *
 * Por que dos fases: property_images tiene UNIQUE (property_id, position)
 * y la galeria es Densa (posiciones 1..N consecutivas, todo slot ocupado).
 * Escribir posiciones finales en secuencia viola la constraint en cuanto
 * hay un swap: [A(1),B(2)] -> [B,A] exige B->1 mientras A sigue ocupando 1.
 * Fase 1 mueve cada imagen a un offset temporal negativo distinto (-(i+1)):
 * fuera del rango valido y unico entre ellas, libera todas las posiciones
 * sin poder chocar ni con las actuales ni entre si. Fase 2 fija el orden
 * final 1..N (computePositions) cuando ya no queda ninguna colision
 * posible. El orden interno de cada fase es irrelevante; lo que importa es
 * que TODAS las filas pasan por negativos antes de recibir su definitiva.
 */
export function buildReorderWrites(ids: string[]): ImagePositionUpdate[] {
  const phaseOne = ids.map((id, index) => ({ id, position: -(index + 1) }));
  return [...phaseOne, ...computePositions(ids)];
}
