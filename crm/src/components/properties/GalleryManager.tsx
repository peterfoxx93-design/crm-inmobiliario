"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteImage, reorderImages, uploadImage } from "@/app/actions/properties";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/image-upload";
import type { PropertyImageFull } from "@/lib/queries/properties";
import { cn } from "@/lib/utils";

/**
 * Gestion de la galeria de la ficha (Task 10 Step 2):
 * - subida multiple a Storage via server action `uploadImage`
 *   (pre-chequeo amable en cliente; la validacion autoritativa es servidor);
 * - grid de miniaturas reordenable con drag & drop (@dnd-kit/sortable),
 *   persistiendo posiciones 1-based via `reorderImages` (optimista);
 * - borrado con ConfirmDialog.
 *
 * La sincronizacion con el servidor NO usa efectos: el padre remonta este
 * componente con un `key` derivado de las imagenes tras cada router.refresh(),
 * y el estado local optimista se reinicia desde props (patron key-reset).
 */
export function GalleryManager({
  propertyId,
  images,
}: {
  propertyId: string;
  images: PropertyImageFull[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado local optimista, inicializado desde el Server Component.
  const [items, setItems] = useState<PropertyImageFull[]>(() =>
    [...images].sort((a, b) => a.position - b.position),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PropertyImageFull | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // permite resubir el mismo archivo
    if (files.length === 0) return;

    let accepted = 0;
    setIsUploading(true);
    try {
      for (const file of files) {
        // Pre-chequeo cliente: mensajes claros sin gastar ancho de banda.
        const validationError = validateImageFile(file);
        if (validationError) {
          toast.error(`${file.name}: ${validationError}`);
          continue;
        }
        const result = await uploadImage(propertyId, file);
        if (!result.ok) {
          toast.error(result.error);
          continue;
        }
        accepted += 1;
        setItems((prev) => [...prev, result.data]);
      }
    } finally {
      setIsUploading(false);
    }

    if (accepted > 0) {
      toast.success(
        accepted === 1 ? "Imagen subida." : `${accepted} imágenes subidas.`,
      );
      startTransition(() => router.refresh());
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(items, oldIndex, newIndex);
    // Optimista: posiciones consecutivas segun el nuevo orden.
    setItems(next.map((item, index) => ({ ...item, position: index + 1 })));

    startTransition(async () => {
      const result = await reorderImages(
        propertyId,
        next.map((item) => item.id),
      );
      if (!result.ok) {
        toast.error(result.error);
        router.refresh(); // revierte al estado real del servidor
        return;
      }
      toast.success("Orden actualizado.");
    });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const result = await deleteImage(target.id);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error); // mantiene el dialogo abierto para reintentar
    }
    setItems((prev) => prev.filter((item) => item.id !== target.id));
    toast.success("Imagen eliminada.");
    startTransition(() => router.refresh());
  }

  return (
    <section aria-label="Galería de imágenes" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Arrastra las miniaturas para cambiar el orden. La primera será la foto
          principal.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="sr-only"
          onChange={handleFilesSelected}
          aria-label="Subir imágenes"
        />
        <Button
          type="button"
          size="sm"
          disabled={isUploading || isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus data-icon="inline-start" aria-hidden />
          {isUploading ? "Subiendo…" : "Subir fotos"}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <ImagePlus className="size-6" aria-hidden />
          <p className="text-sm">Aún no hay fotos.</p>
          <p className="text-xs">
            Formatos JPG, PNG, WEBP, GIF o AVIF · máximo 5 MB por imagen.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((image) => (
                <SortableThumb
                  key={image.id}
                  image={image}
                  disabled={isPending}
                  onRequestDelete={() => setPendingDelete(image)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Eliminar imagen"
        description="Se quitará de la galería y del almacenamiento. Esta acción no se puede deshacer."
        confirmLabel="Eliminar imagen"
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}

interface SortableThumbProps {
  image: PropertyImageFull;
  disabled: boolean;
  onRequestDelete: () => void;
}

/** Miniatura arrastrable con asa accesible por teclado y boton de borrado. */
function SortableThumb({ image, disabled, onRequestDelete }: SortableThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-10 opacity-90 ring-2 ring-primary",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- URLs de Storage sin remotePatterns configurado */}
      <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Reordenar imagen ${image.position}`}
        title="Arrastra para reordenar"
        className="absolute bottom-1 left-1 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-background/80 backdrop-blur transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRequestDelete}
        disabled={disabled}
        aria-label={`Eliminar imagen ${image.position}`}
        className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-md bg-background/80 text-destructive backdrop-blur transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}
