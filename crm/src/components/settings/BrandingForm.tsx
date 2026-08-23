"use client";

/**
 * Tab "Branding" de Ajustes (Task 16): nombre, logo y color primario de la
 * agencia. Preview en vivo del shell mientras se elige color: se escriben
 * `--brand`/`--brand-fg` en documentElement (afecta a sidebar/bottombar, que
 * estan fuera de este formulario); al desmontar se restauran los valores
 * previos. Tras guardar, el layout re-renderizado aplica el valor
 * autoritativo via BrandProvider (estilo inline, que gana al de la raiz).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { updateMyAgencyBrand, uploadAgencyLogo } from "@/app/actions/my-agency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseHex, pickBrandForeground } from "@/lib/color";

interface BrandingFormProps {
  initialName: string;
  initialLogoUrl: string | null;
  initialColor: string;
}

export function BrandingForm({
  initialName,
  initialLogoUrl,
  initialColor,
}: BrandingFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedColor = (() => {
    const rgb = parseHex(color);
    if (!rgb) return null;
    return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  })();

  // Preview en vivo del shell: variables CSS en la raiz mientras se escribe.
  useEffect(() => {
    if (!parsedColor || parsedColor === initialColor.toLowerCase()) return;

    const root = document.documentElement.style;
    const prevBrand = root.getPropertyValue("--brand");
    const prevFg = root.getPropertyValue("--brand-fg");
    root.setProperty("--brand", parsedColor);
    root.setProperty("--brand-fg", pickBrandForeground(parsedColor));

    return () => {
      root.setProperty("--brand", prevBrand);
      root.setProperty("--brand-fg", prevFg);
    };
  }, [parsedColor, initialColor]);

  async function handleSave() {
    setSaving(true);
    const result = await updateMyAgencyBrand({
      name,
      primaryColor: parsedColor ?? "",
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Cambios guardados.");
    router.refresh();
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    const result = await uploadAgencyLogo(file);
    setUploading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setLogoUrl(result.data.url);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Logo actualizado.");
    router.refresh();
  }

  async function handleRemoveLogo() {
    setUploading(true);
    const result = await updateMyAgencyBrand({ logoUrl: null });
    setUploading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setLogoUrl(null);
    toast.success("Logo eliminado.");
    router.refresh();
  }

  const dirty =
    name !== initialName || parsedColor !== initialColor.toLowerCase();

  return (
    <div className="space-y-6 rounded-xl border bg-card p-4 sm:p-6">
      {/* Datos */}
      <div className="space-y-2">
        <Label htmlFor="agency-name">Nombre de la agencia</Label>
        <Input
          id="agency-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Inmobiliaria Sur"
        />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo externo de Storage, tamano fijo
              <img
                src={logoUrl}
                alt={`Logo actual`}
                className="size-full object-contain"
              />
            ) : (
              <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
            )}
          </div>
          <input
            ref={fileInputRef}
            id="agency-logo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="sr-only"
            onChange={(e) => void handleLogoChange(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => void handleRemoveLogo()}
            >
              <Trash2 data-icon="inline-start" aria-hidden />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WEBP, GIF o AVIF; maximo 5 MB.
        </p>
      </div>

      {/* Color primario */}
      <div className="space-y-2">
        <Label htmlFor="agency-color">Color primario</Label>
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
            className="w-36 font-mono"
            placeholder="#2563eb"
          />
          {/* Muestra del par marca/texto que veran los usuarios */}
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
            Muestra
          </span>
        </div>
        {!parsedColor && (
          <p className="text-xs text-destructive">
            Introduce un color hexadecimal válido (por ejemplo #2563eb).
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={() => void handleSave()} disabled={saving || !parsedColor}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        {dirty && !saving && (
          <span className="self-center text-xs text-muted-foreground">
            Hay cambios sin guardar
          </span>
        )}
      </div>
    </div>
  );
}
