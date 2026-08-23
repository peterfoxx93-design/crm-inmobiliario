"use client";

/**
 * Boton "Nuevo contacto" (Task 12): abre dialogo con el formulario
 * compartido del perfil y llama a createContact.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createContact } from "@/app/actions/contacts";
import { ContactProfileForm } from "@/components/contacts/ContactProfileForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewContactButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(values: Parameters<typeof createContact>[0]) {
    setIsPending(true);
    const result = await createContact(values);
    setIsPending(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    }
    return result;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" aria-hidden />
            Nuevo contacto
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
          <DialogDescription>
            Registra un comprador, inquilino o propietario de tu cartera.
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Creando contacto…
          </p>
        ) : (
          <ContactProfileForm submitLabel="Crear contacto" onSubmit={handleSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}
