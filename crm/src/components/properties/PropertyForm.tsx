"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useForm,
  type ControllerRenderProps,
  type DefaultValues,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { createProperty, updateProperty } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FEATURES_LIST, OPERATION_LABELS, PROPERTY_TYPES } from "@/lib/constants";
import { propertySchema } from "@/lib/validators/property";

/**
 * Formulario de la ficha de propiedad (Task 10 Step 1).
 * react-hook-form + zodResolver contra `propertySchema` (el mismo esquema
 * que re-valida la server action). Tres secciones: Datos basicos,
 * Direccion y Caracteristicas (checkboxes fijos del catalogo).
 *
 * Los campos numericos vacios llegan como NaN (`valueAsNumber`) y los de
 * texto como "": el preprocess del schema los convierte en undefined.
 */

type FormInput = z.input<typeof propertySchema>;
type FormOutput = z.output<typeof propertySchema>;

interface PropertyFormProps {
  mode: "create" | "edit";
  /** Obligatorio en modo edicion. */
  propertyId?: string;
  /** Valores iniciales (mapeados desde la fila en el Server Component). */
  defaults?: Partial<FormOutput>;
}

const DEFAULT_VALUES: DefaultValues<FormInput> = {
  title: "",
  description: "",
  operation: undefined,
  property_type: undefined,
  price: undefined,
  bedrooms: null,
  bathrooms: null,
  surface_m2: null,
  address: "",
  city: "",
  zone: "",
  lat: null,
  lng: null,
  features: [],
};

/** Extrae el valor array del campo features con independencia del tipado laxo. */
function selectedFeatures(field: ControllerRenderProps<FormInput, "features">) {
  return Array.isArray(field.value) ? field.value : [];
}

export function PropertyForm({ mode, propertyId, defaults }: PropertyFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(propertySchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaults },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormOutput) {
    setFormError(null);
    const result =
      mode === "create"
        ? await createProperty(values)
        : await updateProperty(propertyId ?? "", values);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    if (mode === "create") {
      toast.success("Propiedad creada como borrador.");
      router.push(`/propiedades/${result.data.id}`);
    } else {
      toast.success("Cambios guardados.");
      router.refresh();
    }
  }

  const cancelHref = mode === "create" ? "/propiedades" : `/propiedades/${propertyId}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {/* --- Datos básicos --- */}
        <section aria-labelledby="datos-basicos" className="space-y-4">
          <h2 id="datos-basicos" className="text-sm font-semibold tracking-tight">
            Datos básicos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej.: Piso luminoso en el centro"
                      {...field}
                      value={typeof field.value === "string" ? field.value : ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="operation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operación *</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una operación" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(OPERATION_LABELS) as [string, string][]).map(
                        ([id, label]) => (
                          <SelectItem key={id} value={id}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="property_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel htmlFor="price">Precio (EUR) *</FormLabel>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="250000"
                {...form.register("price", { valueAsNumber: true })}
              />
              {/* Fuera de FormField: FormMessage necesita contexto y fallaria. */}
              {form.formState.errors.price?.message ? (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {form.formState.errors.price.message}
                </p>
              ) : null}
            </FormItem>

            <div className="grid grid-cols-3 gap-3 sm:col-span-1">
              <FormItem>
                <FormLabel htmlFor="bedrooms">Habit.</FormLabel>
                <Input
                  id="bedrooms"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...form.register("bedrooms", { valueAsNumber: true })}
                />
                {form.formState.errors.bedrooms?.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.bedrooms.message}
                  </p>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="bathrooms">Baños</FormLabel>
                <Input
                  id="bathrooms"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...form.register("bathrooms", { valueAsNumber: true })}
                />
                {form.formState.errors.bathrooms?.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.bathrooms.message}
                  </p>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="surface_m2">m²</FormLabel>
                <Input
                  id="surface_m2"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("surface_m2", { valueAsNumber: true })}
                />
                {form.formState.errors.surface_m2?.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.surface_m2.message}
                  </p>
                ) : null}
              </FormItem>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Describe el inmueble…" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* --- Dirección --- */}
        <section aria-labelledby="direccion" className="space-y-4 border-t pt-6">
          <h2 id="direccion" className="text-sm font-semibold tracking-tight">
            Dirección
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Calle, número, piso…" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad *</FormLabel>
                  <FormControl>
                    <Input placeholder="Madrid" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zona</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej.: Chamberí" {...field} value={typeof field.value === "string" ? field.value : ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:max-w-xs">
              <FormItem>
                <FormLabel htmlFor="lat">Latitud</FormLabel>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  {...form.register("lat", { valueAsNumber: true })}
                />
                {form.formState.errors.lat?.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.lat.message}
                  </p>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="lng">Longitud</FormLabel>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  {...form.register("lng", { valueAsNumber: true })}
                />
                {form.formState.errors.lng?.message ? (
                  <p className="text-[0.8rem] font-medium text-destructive">
                    {form.formState.errors.lng.message}
                  </p>
                ) : null}
              </FormItem>
            </div>
          </div>
        </section>

        {/* --- Características --- */}
        <section aria-labelledby="caracteristicas" className="space-y-4 border-t pt-6">
          <h2 id="caracteristicas" className="text-sm font-semibold tracking-tight">
            Características
          </h2>
          <FormField
            control={form.control}
            name="features"
            render={({ field }) => {
              const selected = selectedFeatures(field);
              return (
                <FormItem>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {FEATURES_LIST.map((feature) => (
                      <label
                        key={feature.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selected.includes(feature.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...selected, feature.id]
                                : selected.filter((id) => id !== feature.id),
                            )
                          }
                          disabled={isSubmitting}
                        />
                        {feature.label}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </section>

        {formError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {formError}
          </p>
        ) : null}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Guardando…"
              : mode === "create"
                ? "Crear propiedad"
                : "Guardar cambios"}
          </Button>
          <Button type="button" variant="ghost" render={<Link href={cancelHref} />}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
