"use client";

/**
 * Tab "Captacion web" de Ajustes (Task 18): toggle de activacion del
 * formulario publico y snippet iframe copiable para incrustarlo en la web
 * de la agencia. El guard real vive en la server action (admin/super_admin).
 */

import { useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { setWebFormEnabledAction } from "@/app/actions/my-agency";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WebCapturePanelProps {
  /** Slug de la agencia efectiva (ya resuelto en el servidor). */
  slug: string;
  /** Estado inicial de settings.web_form.enabled. */
  enabled: boolean;
  /** Config de campos (solo informativo: se edita desde el panel Maestro). */
  showEmail: boolean;
  showMessage: boolean;
}

/** Suscripcion nula: el origen no cambia durante la vida de la pagina. */
const subscribeNoop = () => () => {};

export function WebCapturePanel({
  slug,
  enabled: initialEnabled,
  showEmail,
  showMessage,
}: WebCapturePanelProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  // Origen solo en cliente (patron LoginForm): evita desajuste de
  // hidratacion; en servidor devuelve "" y el boton queda desactivado.
  const appOrigin = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => "",
  );

  const snippet = `<iframe src="${appOrigin}/form/${slug}" style="width:100%;height:640px;border:0;border-radius:12px"></iframe>`;

  async function handleToggle(next: boolean) {
    setPending(true);
    const result = await setWebFormEnabledAction(next);
    if (result.ok) {
      setEnabled(next);
      toast.success(
        next
          ? "Captación web activada."
          : "Captación web desactivada.",
      );
    } else {
      toast.error(result.error);
    }
    setPending(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se ha podido copiar el código. Cópialo manualmente.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toggle de activacion */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="web-capture-toggle" className="text-sm font-medium">
              Formulario de contacto público
            </Label>
            <p className="text-sm text-muted-foreground">
              Permite recibir leads desde tu web con un formulario embebible.
              Cada lead entra en Contactos como origen «web» con su
              consentimiento RGPD registrado.
            </p>
          </div>
          {/* Switch accesible sin dependencia nueva */}
          <button
            id="web-capture-toggle"
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={pending}
            onClick={() => void handleToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block size-5 transform rounded-full bg-background shadow transition-transform ${
                enabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Campo email</dt>
            <dd>{showEmail ? "Visible" : "Oculto"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Campo mensaje</dt>
            <dd>{showMessage ? "Visible" : "Oculto"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Los campos visibles y el mensaje de gracias se configuran desde el
          panel Maestro, en la ficha de la agencia.
        </p>
      </div>

      {/* Snippet iframe copiable */}
      <div className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">Incrustar en tu web</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copia este código y pégalo en tu página de contacto:
        </p>
        <Textarea
          readOnly
          value={snippet}
          rows={3}
          aria-label="Código iframe para incrustar el formulario"
          className="mt-3 resize-none font-mono text-xs"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!appOrigin || !enabled}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check aria-hidden className="size-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy aria-hidden className="size-4" />
                Copiar código
              </>
            )}
          </Button>
        </div>
        {!enabled ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Activa el formulario para poder compartir el código.
          </p>
        ) : null}
      </div>
    </div>
  );
}
