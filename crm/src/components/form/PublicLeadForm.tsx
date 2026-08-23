"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Formulario publico del lead (Task 18). Cliente puro: valida lo minimo en
 * navegador (UX), pero la verificacion real vive en el endpoint (Zod server,
 * honeypot, rate limit). Campos condicionales segun settings.web_form:
 * showEmail/showMessage. 100% en espanol y mobile-first.
 */

interface PublicLeadFormProps {
  slug: string;
  showEmail: boolean;
  showMessage: boolean;
  /** Mensaje de gracias configurable; vacio -> texto por defecto. */
  thanksMessage?: string;
  primaryColor: string;
}

type Status = "idle" | "sending" | "success" | "error";

const DEFAULT_THANKS =
  "Gracias. Hemos recibido tu solicitud y te contactaremos lo antes posible.";
const RATE_LIMIT_ERROR =
  "Has enviado demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.";
const GENERIC_ERROR =
  "No se ha podido enviar el formulario. Inténtalo de nuevo en unos segundos.";

export function PublicLeadForm({
  slug,
  showEmail,
  showMessage,
  thanksMessage,
  primaryColor,
}: PublicLeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>(GENERIC_ERROR);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("sending");
    setErrorMessage(GENERIC_ERROR);

    try {
      const response = await fetch(`/api/public/leads/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(data.get("fullName") ?? ""),
          phone: String(data.get("phone") ?? ""),
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
          // HONEYPOT: se envia tal cual para que el servidor decida.
          companyUrl: String(data.get("companyUrl") ?? ""),
        }),
      });

      if (response.ok) {
        setStatus("success");
        form.reset();
        return;
      }
      setErrorMessage(
        response.status === 429 ? RATE_LIMIT_ERROR : GENERIC_ERROR,
      );
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-xl border bg-card p-6 text-center shadow-sm"
        role="status"
      >
        <h2 className="text-base font-semibold">Solicitud enviada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {thanksMessage?.trim() ? thanksMessage.trim() : DEFAULT_THANKS}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6"
      noValidate={false}
    >
      {/* HONEYPOT: invisible para personas; los bots lo rellenan */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="companyUrl">No rellenar este campo</label>
        <input
          id="companyUrl"
          name="companyUrl"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nombre *</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Tu nombre"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Teléfono *</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          maxLength={32}
          autoComplete="tel"
          placeholder="Ej. +34 600 123 456"
        />
      </div>

      {showEmail ? (
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            maxLength={160}
            autoComplete="email"
            placeholder="tu@email.com"
          />
        </div>
      ) : null}

      {showMessage ? (
        <div className="space-y-1.5">
          <Label htmlFor="message">Mensaje</Label>
          <Textarea
            id="message"
            name="message"
            rows={4}
            maxLength={2000}
            placeholder="Cuéntanos qué buscas"
          />
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          required
          className="mt-0.5 size-4 shrink-0 accent-current"
          style={{ accentColor: primaryColor }}
        />
        <Label
          htmlFor="consent"
          className="text-xs font-normal leading-snug text-muted-foreground"
        >
          Consiento el tratamiento de mis datos por la agencia para atender esta
          solicitud, conforme al RGPD.
        </Label>
      </div>

      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={status === "sending"}
        className="w-full"
        style={{ backgroundColor: primaryColor }}
      >
        {status === "sending" ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          "Enviar solicitud"
        )}
      </Button>
    </form>
  );
}
