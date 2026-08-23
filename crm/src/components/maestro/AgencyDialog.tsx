"use client";

/**
 * Dialogo de alta/edicion de agencia (Task 17): nombre, slug, logo (URL),
 * color con presets + preview en vivo del shell (lib/brand-preview, mismo
 * mecanismo que BrandingForm) y ajustes: SLA de lead, dias por etapa del
 * pipeline y formulario web (Task 18). La validacion final vive en
 * lib/validators/agency.ts aplicada por la server action upsertAgency.
 *
 * El formulario interior se MONTA solo con el dialogo abierto y con `key`
 * por fila: sus useState se inicializan desde props sin efectos de reset
 * (regla react-hooks/set-state-in-effect).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { upsertAgency } from "@/app/actions/agencies";
import {
  applyBrandPreview,
  clearBrandPreview,
} from "@/lib/brand-preview";
import { parseHex, pickBrandForeground } from "@/lib/color";
import { DEAL_STAGES } from "@/lib/constants";
import type { Agency, AgencySettings } from "@/lib/types";
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

interface WebFormState {
  enabled: boolean;
  showEmail: boolean;
  showMessage: boolean;
  thanksMessage: string;
}

const EMPTY_WEB_FORM: WebFormState = {
  enabled: false,
  showEmail: false,
  showMessage: true,
  thanksMessage: "",
};

/** Preset de colores de marca (paleta operativa + complementarios). */
const COLOR_PRESETS = [
  "#2563eb",
  "#0a7b5b",
  "#b91c1c",
  "#c2410c",
  "#7c3aed",
  "#0f766e",
  "#be185d",
  "#475569",
] as const;

interface AgencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fila a editar; null = alta. */
  row: {
    agency: Agency;
  } | null;
}

function readWebForm(settings: AgencySettings | undefined | null): WebFormState {
  const raw = settings?.web_form;
  if (!raw || typeof raw !== "object") return EMPTY_WEB_FORM;
  const w = raw as Record<string, unknown>;
  return {
    enabled: w.enabled === true,
    showEmail: w.showEmail === true,
    showMessage: w.showMessage !== false,
    thanksMessage: typeof w.thanksMessage === "string" ? w.thanksMessage : "",
  };
}

export function AgencyDialog({ open, onOpenChange, row }: AgencyDialogProps) {
  const agency = row?.agency ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {open ? (
          <AgencyDialogForm
            key={agency?.id ?? "nueva"}
            agency={agency}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface AgencyDialogFormProps {
  agency: Agency | null;
  onClose: () => void;
}

function AgencyDialogForm({ agency, onClose }: AgencyDialogFormProps) {
  const router = useRouter();

  // Estado inicial desde props (el componente se monta fresco por `key`).
  const [name, setName] = useState(agency?.name ?? "");
  const [slug, setSlug] = useState(agency?.slug ?? "");
  const [color, setColor] = useState(agency?.primary_color ?? "#2563eb");
  const [logoUrl, setLogoUrl] = useState(agency?.logo_url ?? "");
  const [slaHours, setSlaHours] = useState(() => {
    const value = agency?.settings.sla_lead_hours;
    return typeof value === "number" ? String(value) : "";
  });
  const [stageDays, setStageDays] = useState<Record<string, string>>(() => {
    const days: Record<string, string> = {};
    for (const stage of DEAL_STAGES) {
      const value = agency?.settings.pipeline_stage_days?.[stage.id];
      if (typeof value === "number") days[stage.id] = String(value);
    }
    return days;
  });
  const [webForm, setWebForm] = useState<WebFormState>(() =>
    readWebForm(agency?.settings),
  );
  const [saving, setSaving] = useState(false);

  // Preview en vivo del shell mientras se elige color (patron BrandingForm):
  // escribe --brand-preview(-fg) en documentElement (sistema externo, no
  // estado React); al desmontar/cerrar se restauran los valores guardados.
  const parsedColor = (() => {
    const rgb = parseHex(color);
    if (!rgb) return null;
    return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  })();

  useEffect(() => {
    if (!parsedColor || parsedColor === (agency?.primary_color ?? "").toLowerCase()) {
      return;
    }
    applyBrandPreview(parsedColor);
    return () => clearBrandPreview();
  }, [parsedColor, agency]);

  async function handleSave() {
    if (!parsedColor) return; // el propio formulario avisa del hex invalido
    setSaving(true);

    const pipelineStageDays: Record<string, number> = {};
    for (const [stageId, raw] of Object.entries(stageDays)) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) pipelineStageDays[stageId] = parsed;
    }

    const result = await upsertAgency({
      id: agency?.id ?? null,
      name,
      slug: slug.trim() ? slug.trim() : undefined,
      color,
      logoUrl: logoUrl.trim() ? logoUrl.trim() : null,
      slaLeadHours: slaHours.trim() ? Number(slaHours.trim()) : null,
      pipelineStageDays:
        Object.keys(pipelineStageDays).length > 0 ? pipelineStageDays : undefined,
      webForm:
        webForm.enabled ||
        webForm.showEmail ||
        !webForm.showMessage ||
        webForm.thanksMessage.trim()
          ? {
              enabled: webForm.enabled,
              showEmail: webForm.showEmail,
              showMessage: webForm.showMessage,
              ...(webForm.thanksMessage.trim()
                ? { thanksMessage: webForm.thanksMessage.trim() }
                : {}),
            }
          : undefined,
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(agency ? "Agencia actualizada." : "Agencia creada.");
    onClose();
    router.refresh();
  }

  function updateStageDay(stageId: string, value: string) {
    setStageDays((prev) => ({ ...prev, [stageId]: value }));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {agency ? `Editar ${agency.name}` : "Nueva agencia"}
        </DialogTitle>
        <DialogDescription>
          El branding se aplica al login y al shell de sus usuarios.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        {/* Nombre */}
        <div className="grid gap-2">
          <Label htmlFor="agency-name">Nombre</Label>
          <Input
            id="agency-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Inmobiliaria Sur"
          />
        </div>

        {/* Slug */}
        <div className="grid gap-2">
          <Label htmlFor="agency-slug">Identificador (slug)</Label>
          <Input
            id="agency-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="fincas-sur"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Se genera del nombre si lo dejas vacío. URL de acceso:
            /login?agencia=slug
          </p>
        </div>

        {/* Logo */}
        <div className="grid gap-2">
          <Label htmlFor="agency-logo-url">Logo (URL https)</Label>
          <Input
            id="agency-logo-url"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
          />
        </div>

        {/* Color con presets + preview */}
        <div className="grid gap-2">
          <Label htmlFor="agency-color">Color primario</Label>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colores predefinidos">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Usar color ${preset}`}
                aria-pressed={parsedColor === preset}
                onClick={() => setColor(preset)}
                className={`size-8 rounded-full border transition-transform ${
                  parsedColor === preset
                    ? "scale-110 border-foreground ring-2 ring-ring"
                    : "border-border hover:scale-105"
                }`}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Elegir color primario"
              value={parsedColor ?? "#2563eb"}
              onChange={(e) => setColor(e.target.value)}
              className="size-10 cursor-pointer rounded-md border bg-card p-1"
            />
            <Input
              id="agency-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-32 font-mono"
              placeholder="#2563eb"
            />
            {/* Muestra del par marca/texto */}
            <span
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={
                parsedColor
                  ? {
                      backgroundColor: parsedColor,
                      color: pickBrandForeground(parsedColor),
                    }
                  : undefined
              }
            >
              Vista previa
            </span>
          </div>
          {!parsedColor && (
            <p className="text-xs text-destructive">
              Introduce un color hexadecimal válido (por ejemplo #2563eb).
            </p>
          )}
        </div>

        {/* Ajustes operativos */}
        <div className="rounded-lg border p-3">
          <p className="mb-3 text-sm font-medium">Ajustes operativos</p>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="agency-sla">SLA primer contacto (horas)</Label>
              <Input
                id="agency-sla"
                type="number"
                min={0}
                max={720}
                inputMode="numeric"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Sin límite"
              />
            </div>

            <div className="grid gap-2">
              <Label>Días objetivo por etapa del pipeline</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEAL_STAGES.map((stage) => (
                  <div key={stage.id} className="grid gap-1">
                    <Label
                      htmlFor={`stage-days-${stage.id}`}
                      className="text-xs font-normal text-muted-foreground"
                    >
                      {stage.label}
                    </Label>
                    <Input
                      id={`stage-days-${stage.id}`}
                      type="number"
                      min={1}
                      max={365}
                      inputMode="numeric"
                      value={stageDays[stage.id] ?? ""}
                      onChange={(e) => updateStageDay(stage.id, e.target.value)}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Formulario web</legend>
              {(
                [
                  ["enabled", "Activo"],
                  ["showEmail", "Mostrar campo de correo"],
                  ["showMessage", "Mostrar campo de mensaje"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={webForm[key]}
                    onChange={(e) =>
                      setWebForm((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="size-4 accent-[var(--brand)]"
                  />
                  {label}
                </label>
              ))}
              <div className="grid gap-1">
                <Label htmlFor="webform-thanks" className="text-xs font-normal text-muted-foreground">
                  Mensaje de gracias
                </Label>
                <Input
                  id="webform-thanks"
                  value={webForm.thanksMessage}
                  maxLength={280}
                  onChange={(e) =>
                    setWebForm((prev) => ({ ...prev, thanksMessage: e.target.value }))
                  }
                  placeholder="Gracias, te contactamos muy pronto."
                />
              </div>
            </fieldset>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim() || !parsedColor}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : agency ? (
            "Guardar cambios"
          ) : (
            "Crear agencia"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
