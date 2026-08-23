"use client";

/**
 * Acciones rapidas del drawer 360 (Task 12 Step 2): Llamada / Email / Nota
 * (composer), WhatsApp (wa.me, pestaña nueva), Tarea (con fecha) y Oferta.
 */

import { useState } from "react";
import { FileText, Home, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { ActivityComposer } from "@/components/shared/ActivityComposer";
import { DealCreateDialog } from "@/components/contacts/DealCreateDialog";
import type { DealCreateDialogProps } from "@/components/contacts/DealCreateDialog";
import { Button } from "@/components/ui/button";

type ComposerType = "llamada" | "email" | "nota" | "tarea";

/** Deja solo digitos para wa.me; null si queda vacio. */
export function phoneToWaTarget(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

export interface QuickActionsProps {
  contactId: string;
  contactPhone: string;
  propertyOptions: DealCreateDialogProps["properties"];
  onActivitySaved: () => void;
  onOfferCreated: () => void;
}

export function QuickActions({
  contactId,
  contactPhone,
  propertyOptions,
  onActivitySaved,
  onOfferCreated,
}: QuickActionsProps) {
  const [composer, setComposer] = useState<ComposerType | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);

  const waTarget = phoneToWaTarget(contactPhone);
  const waHref = waTarget
    ? `https://wa.me/${waTarget}${contactId ? `?text=${encodeURIComponent("Hola, le contacto por su búsqueda inmobiliaria.")}` : ""}`
    : null;

  function openWhatsApp() {
    if (!waHref) {
      toast.error("Este contacto no tiene un teléfono válido para WhatsApp.");
      return;
    }
    window.open(waHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Acciones rápidas
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setComposer("llamada")}>
          <Phone aria-hidden className="size-4" /> Llamada
        </Button>
        <Button variant="outline" size="sm" onClick={() => setComposer("email")}>
          <Mail aria-hidden className="size-4" /> Email
        </Button>
        <Button variant="outline" size="sm" onClick={() => setComposer("nota")}>
          <FileText aria-hidden className="size-4" /> Nota
        </Button>
        <Button variant="outline" size="sm" onClick={openWhatsApp}>
          <MessageCircle aria-hidden className="size-4" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={() => setComposer("tarea")}>
          Tarea
        </Button>
        <Button size="sm" onClick={() => setOfferOpen(true)}>
          <Home aria-hidden className="size-4" /> Oferta
        </Button>
      </div>

      {composer && (
        <ActivityComposer
          type={composer}
          contactId={contactId}
          open={composer !== null}
          onOpenChange={(open) => !open && setComposer(null)}
          onSaved={onActivitySaved}
        />
      )}

      <DealCreateDialog
        contactId={contactId}
        properties={propertyOptions}
        open={offerOpen}
        onOpenChange={setOfferOpen}
        onCreated={onOfferCreated}
      />
    </div>
  );
}
