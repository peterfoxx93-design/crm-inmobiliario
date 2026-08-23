"use client";

/**
 * Dialogo de creacion de oferta (Task 12 Step 2): select de propiedad +
 * importe. Crea un deal en nuevo_lead y la activity 'sistema' correspondiente.
 */

import { useState } from "react";
import { toast } from "sonner";

import { createOffer } from "@/app/actions/contacts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PropertyOption {
  id: string;
  title: string;
  reference: string;
}

export interface DealCreateDialogProps {
  contactId: string;
  properties: readonly PropertyOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function DealCreateDialog({
  contactId,
  properties,
  open,
  onOpenChange,
  onCreated,
}: DealCreateDialogProps) {
  const [propertyId, setPropertyId] = useState<string>("");
  const [value, setValue] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!propertyId || !value.trim()) return;
    setIsPending(true);
    const result = await createOffer({ contactId, propertyId, value });
    setIsPending(false);

    if (result.ok) {
      toast.success("Oferta creada en el pipeline.");
      setPropertyId("");
      setValue("");
      onOpenChange(false);
      onCreated?.();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva oferta</DialogTitle>
          <DialogDescription>
            Se creará un deal en etapa «Nuevo lead» y se registrará en la timeline.
          </DialogDescription>
        </DialogHeader>

        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay propiedades disponibles para ofertar.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="offer-property">Propiedad</Label>
              <Select
                value={propertyId}
                onValueChange={(value) => setPropertyId(value ?? "")}
              >
                <SelectTrigger id="offer-property" className="w-full">
                  <SelectValue placeholder="Selecciona una propiedad" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.reference} · {property.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="offer-value">Importe (EUR)</Label>
              <Input
                id="offer-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !propertyId}>
                {isPending ? "Creando…" : "Crear oferta"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
