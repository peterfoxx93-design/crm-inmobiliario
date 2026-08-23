"use client";

/**
 * Barra de filtros de contactos (Task 12): q + estado + chips removibles.
 * Misma sincronizacion URL que propiedades (router.push en transicion).
 */

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_STATUS_META } from "@/lib/constants";
import {
  contactFiltersToSearchParams,
  withoutContactFilters,
  type ContactFilterKey,
  type ContactFilters,
} from "@/lib/contact-filters";

const STATUS_OPTIONS = Object.entries(CONTACT_STATUS_META).map(
  ([id, meta]) => ({ id, label: meta.label }),
);

export function ContactsFilterBar({ filters }: { filters: ContactFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [qDraft, setQDraft] = useState(filters.q ?? "");

  function apply(next: ContactFilters) {
    const qs = contactFiltersToSearchParams(next).toString();
    startTransition(() => {
      router.push(qs ? `/contactos?${qs}` : "/contactos");
    });
  }

  const activeChips: Array<{ key: ContactFilterKey; label: string }> = [];
  if (filters.q) activeChips.push({ key: "q", label: `“${filters.q}”` });
  if (filters.status) {
    activeChips.push({
      key: "status",
      label: CONTACT_STATUS_META[filters.status].label,
    });
  }
  if (filters.source) activeChips.push({ key: "source", label: filters.source });

  return (
    <div className="space-y-3">
      <form
        aria-busy={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          apply({ ...filters, q: qDraft.trim() || undefined, page: 1 });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          value={qDraft}
          onChange={(event) => setQDraft(event.target.value)}
          placeholder="Buscar por nombre, teléfono o email…"
          aria-label="Buscar contactos"
          className="max-w-xs"
        />
        <Select
          value={filters.status ?? ""}
          onValueChange={(value) =>
            apply({
              ...withoutContactFilters(filters, ["status"]),
              status: value === "" ? undefined : (value as ContactFilters["status"]),
            })
          }
        >
          <SelectTrigger className="w-44" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
      </form>

      {activeChips.length > 0 && (
        <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => apply(withoutContactFilters(filters, [chip.key]))}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs hover:bg-accent"
              >
                {chip.label}
                <X aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
