"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPERATION_LABELS,
  PROPERTY_STATUS_META,
  PROPERTY_TYPES,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  filtersToSearchParams,
  withoutPropertyFilters,
  type PropertyFilterKey,
  type PropertyFilters,
} from "@/lib/property-filters";

interface PropertyFiltersBarProps {
  /** Filtros activos actuales (parseados en el Server Component). */
  filters: PropertyFilters;
  className?: string;
}

/**
 * Barra de filtros del listado (Task 9). Sincroniza con la URL via
 * `router.push` dentro de `startTransition`: mientras el Server Component
 * recarga, el boundary Suspense de la pagina muestra skeletons.
 *
 * - q y precios se aplican al enviar (evita navegar por cada tecla).
 * - selects de estado/operacion/tipo aplican al cambiar.
 * - chips removibles para cada filtro activo.
 */
export function PropertyFiltersBar({ filters, className }: PropertyFiltersBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  // Borradores locales de los campos con texto; se envian al aplicar.
  const [qDraft, setQDraft] = useState(filters.q ?? "");
  const [priceMinDraft, setPriceMinDraft] = useState(
    filters.priceMin != null ? String(filters.priceMin) : "",
  );
  const [priceMaxDraft, setPriceMaxDraft] = useState(
    filters.priceMax != null ? String(filters.priceMax) : "",
  );

  function apply(next: PropertyFilters) {
    const qs = filtersToSearchParams(next).toString();
    startTransition(() => {
      router.push(qs ? `/propiedades?${qs}` : "/propiedades");
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({
      ...filters,
      q: qDraft.trim() || undefined,
      priceMin: priceMinDraft.trim() ? Number(priceMinDraft) : undefined,
      priceMax: priceMaxDraft.trim() ? Number(priceMaxDraft) : undefined,
      page: 1,
    });
  }

  const activeChips = buildActiveChips(filters);

  return (
    <div data-slot="property-filters" className={className}>
      <form onSubmit={handleSubmit} aria-busy={isPending} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`${formId}-q`}
            type="search"
            placeholder="Buscar por título, referencia o ciudad…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            disabled={isPending}
            className="h-8 min-w-52 flex-1"
          />

          <Select
            value={filters.status ?? ""}
            onValueChange={(value) =>
              apply({ ...filters, status: (value || undefined) as PropertyFilters["status"], page: 1 })
            }
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-36" aria-label="Estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Estado: todos</SelectItem>
              {Object.entries(PROPERTY_STATUS_META).map(([id, meta]) => (
                <SelectItem key={id} value={id}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.operation ?? ""}
            onValueChange={(value) =>
              apply({
                ...filters,
                operation: (value || undefined) as PropertyFilters["operation"],
                page: 1,
              })
            }
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-32" aria-label="Operación">
              <SelectValue placeholder="Operación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Operación</SelectItem>
              {Object.entries(OPERATION_LABELS).map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.property_type ?? ""}
            onValueChange={(value) =>
              apply({
                ...filters,
                property_type: (value || undefined) as PropertyFilters["property_type"],
                page: 1,
              })
            }
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-32" aria-label="Tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tipo</SelectItem>
              {PROPERTY_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Precio mín."
            aria-label="Precio mínimo"
            value={priceMinDraft}
            onChange={(e) => setPriceMinDraft(e.target.value)}
            disabled={isPending}
            className="h-8 w-28"
          />
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Precio máx."
            aria-label="Precio máximo"
            value={priceMaxDraft}
            onChange={(e) => setPriceMaxDraft(e.target.value)}
            disabled={isPending}
            className="h-8 w-28"
          />

          <Button type="submit" size="sm" disabled={isPending}>
            Aplicar
          </Button>
        </div>

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={isPending}
                onClick={() => apply(withoutPropertyFilters(filters, [chip.key]))}
                className="group/chip inline-flex h-5 items-center gap-0.5 rounded-full border bg-secondary px-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                {chip.label}
                <X className="size-3 text-muted-foreground group-hover/chip:text-foreground" aria-hidden />
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={isPending}
              onClick={() => apply(withoutPropertyFilters(filters, ACTIVE_KEYS))}
              className="text-muted-foreground"
            >
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

const ACTIVE_KEYS: PropertyFilterKey[] = [
  "q",
  "status",
  "operation",
  "property_type",
  "priceMin",
  "priceMax",
];

interface ActiveChip {
  key: PropertyFilterKey;
  label: string;
}

/** Chips legibles de los filtros activos (etiquetas en espanol). */
function buildActiveChips(filters: PropertyFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `«${filters.q}»` });
  if (filters.status) {
    chips.push({ key: "status", label: PROPERTY_STATUS_META[filters.status].label });
  }
  if (filters.operation) {
    chips.push({ key: "operation", label: OPERATION_LABELS[filters.operation] });
  }
  if (filters.property_type) {
    const type = PROPERTY_TYPES.find((t) => t.id === filters.property_type);
    if (type) chips.push({ key: "property_type", label: type.label });
  }
  if (typeof filters.priceMin === "number") {
    chips.push({ key: "priceMin", label: `Desde ${formatCurrency(filters.priceMin)}` });
  }
  if (typeof filters.priceMax === "number") {
    chips.push({ key: "priceMax", label: `Hasta ${formatCurrency(filters.priceMax)}` });
  }
  return chips;
}
