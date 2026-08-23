"use client";

/**
 * Formulario del perfil de contacto (Task 12): compartido por el dialogo
 * "Nuevo contacto" y la edicion inline del drawer. RHF + zodResolver.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ContactInput } from "@/lib/validators/contact";

import { contactSchema } from "@/lib/validators/contact";
import type { Contact } from "@/lib/types";

/** Tipo de entrada del formulario (antes de aplicar defaults del esquema). */
type ContactFormInput = z.input<typeof contactSchema>;

export interface ContactProfileFormProps {
  /** Valores iniciales; undefined = modo creacion. */
  contact?: Contact;
  submitLabel: string;
  onSubmit: (values: ContactInput) => Promise<{ ok: boolean; error?: string }>;
  onSuccess?: () => void;
}

const CONTACT_TYPE_OPTIONS: Array<{ id: Contact["contact_type"]; label: string }> = [
  { id: "comprador", label: "Comprador" },
  { id: "inquilino", label: "Inquilino" },
  { id: "propietario", label: "Propietario" },
];

const SOURCE_OPTIONS = [
  { id: "web", label: "Web" },
  { id: "manual", label: "Manual" },
  { id: "referido", label: "Referido" },
  { id: "portal", label: "Portal" },
] as const;

export function ContactProfileForm({
  contact,
  submitLabel,
  onSubmit,
  onSuccess,
}: ContactProfileFormProps) {
  const [isPending, setIsPending] = useState(false);
  const zonesDefault = (contact?.preferences?.zones ?? []).join(", ");

  const form = useForm<ContactFormInput, unknown, ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      full_name: contact?.full_name ?? "",
      contact_type: contact?.contact_type ?? "comprador",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      source: contact?.source ?? "manual",
      status: contact?.status ?? "nuevo",
      budget_max: contact?.budget_max ?? undefined,
      preferred_zones: contact?.preferences?.zones ?? [],
      notes: contact?.notes ?? "",
      consent_rgpd: contact?.consent_rgpd ?? false,
    },
  });

  async function handleSubmit(values: ContactInput) {
    setIsPending(true);
    const result = await onSubmit(values);
    setIsPending(false);
    if (result.ok) {
      toast.success(
        contact ? "Contacto actualizado." : "Contacto creado.",
      );
      onSuccess?.();
    } else {
      toast.error(result.error ?? "No se ha podido guardar el contacto.");
    }
  }

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="contact-full-name">Nombre completo</Label>
        <Input id="contact-full-name" {...form.register("full_name")} />
        {errors.full_name && (
          <p role="alert" className="text-xs text-red-600">{errors.full_name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-type">Tipo</Label>
        <Select
          value={form.watch("contact_type")}
          onValueChange={(value) =>
            form.setValue(
              "contact_type",
              value as ContactFormInput["contact_type"],
            )
          }
        >
          <SelectTrigger id="contact-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-source">Origen</Label>
        <Select
          value={form.watch("source")}
          onValueChange={(value) =>
            form.setValue("source", value as ContactFormInput["source"])
          }
        >
          <SelectTrigger id="contact-source" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-phone">Teléfono</Label>
        <Input id="contact-phone" inputMode="tel" {...form.register("phone")} />
        {errors.phone && (
          <p role="alert" className="text-xs text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" type="email" {...form.register("email")} />
        {errors.email && (
          <p role="alert" className="text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-budget">Presupuesto máx. (EUR)</Label>
        <Input
          id="contact-budget"
          inputMode="decimal"
          {...form.register("budget_max")}
        />
        {errors.budget_max && (
          <p role="alert" className="text-xs text-red-600">{errors.budget_max.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="contact-zones">Zonas preferidas</Label>
        <Input
          id="contact-zones"
          placeholder="Centro, Playa…"
          defaultValue={zonesDefault}
          onChange={(event) =>
            form.setValue(
              "preferred_zones",
              event.target.value
                .split(",")
                .map((zone) => zone.trim())
                .filter(Boolean),
            )
          }
        />
      </div>

      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="contact-notes">Notas</Label>
        <Textarea id="contact-notes" rows={3} {...form.register("notes")} />
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox
          checked={form.watch("consent_rgpd")}
          onCheckedChange={(checked) =>
            form.setValue("consent_rgpd", checked === true)
          }
        />
        Consentimiento RGPD otorgado
      </label>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
