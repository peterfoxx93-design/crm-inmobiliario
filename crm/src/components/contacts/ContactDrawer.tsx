"use client";

/**
 * Drawer 360 del contacto (Task 12 Step 2): perfil editable inline +
 * timeline de actividades + acciones rapidas. Se abre desde la tabla;
 * al cerrar no se pierden los filtros (solo cambia el estado local).
 */

import { useCallback, useEffect, useState } from "react";

import { updateContact } from "@/app/actions/contacts";
import { ActivityFeed } from "@/components/shared/ActivityFeed";
import { ContactProfileForm } from "@/components/contacts/ContactProfileForm";
import {
  QuickActions,
} from "@/components/contacts/QuickActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_STATUS_META } from "@/lib/constants";
import type { Activity, Contact } from "@/lib/types";
import type { DealCreateDialogProps } from "@/components/contacts/DealCreateDialog";

export interface ContactDrawerProps {
  contact: Contact;
  propertyOptions: DealCreateDialogProps["properties"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDrawer({
  contact,
  propertyOptions,
  open,
  onOpenChange,
}: ContactDrawerProps) {
  const [reloadKey, setReloadKey] = useState(0);
  // Estado de carga derivado: la consulta activa es (contacto, apertura, reload).
  const fetchKey = `${contact.id}:${open ? 1 : 0}:${reloadKey}`;
  const [fetched, setFetched] = useState<{
    key: string;
    activities: Activity[];
    error: string | null;
  }>({ key: "", activities: [], error: null });
  const isLoadingActivities = fetched.key !== fetchKey;
  const activities = fetched.activities;

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!open || !isLoadingActivities) return;
    let cancelled = false;
    // Cliente browser de @supabase/ssr: la sesion vive en cookies compartidas
    // con el server (un cliente crudo de supabase-js no tendria sesion).
    const supabase = createClient();

    supabase
      .from("activities")
      .select("*")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!cancelled) {
          setFetched({
            key: fetchKey,
            activities: (data ?? []) as Activity[],
            error: error ? "No se ha podido cargar el historial." : null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contact.id, open, isLoadingActivities, fetchKey]);

  async function handleUpdate(values: Parameters<typeof updateContact>[1]) {
    return updateContact(contact.id, values);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{contact.full_name}</SheetTitle>
            <StatusBadge meta={CONTACT_STATUS_META[contact.status]} />
            {contact.consent_rgpd ? (
              <Badge className="bg-green-100 text-green-800">RGPD OK</Badge>
            ) : (
              <Badge variant="outline" className="text-red-600">
                Sin RGPD
              </Badge>
            )}
          </div>
          <SheetDescription>
            Ficha completa del contacto: perfil, historial y acciones.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-4 pb-8">
          {/* Arriba: acciones rápidas — siempre visible sin scroll */}
          <section
            aria-label="Acciones rápidas"
            className="rounded-xl border bg-muted/30 p-4"
          >
            <QuickActions
              contactId={contact.id}
              contactPhone={contact.phone}
              propertyOptions={propertyOptions}
              onActivitySaved={reload}
              onOfferCreated={reload}
            />
          </section>

          {/* Perfil editable */}
          <section aria-label="Perfil del contacto">
            <ContactProfileForm
              contact={contact}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => handleUpdate(values)}
              onSuccess={reload}
            />
          </section>

          {/* Timeline */}
          <section aria-label="Historial de actividades">
            {isLoadingActivities ? (
              <p className="text-sm text-muted-foreground">Cargando historial…</p>
            ) : fetched.error ? (
              <div role="alert" className="flex items-center gap-2 text-sm text-red-600">
                {fetched.error}
                <Button variant="outline" size="sm" onClick={reload}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <ActivityFeed activities={activities} />
            )}
          </section>
        </div>

        <div className="px-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
