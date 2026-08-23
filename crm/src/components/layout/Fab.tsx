"use client";

import { CreateMenu } from "@/components/layout/CreateMenu";

/**
 * Boton flotante de creacion rapida en movil (brief Step 3):
 * esquina inferior derecha, sobre la BottomBar; abre el mismo CreateMenu.
 */
export function Fab() {
  return (
    <div className="fixed right-4 bottom-[4.5rem] z-40 md:hidden">
      <CreateMenu variant="fab" />
    </div>
  );
}
