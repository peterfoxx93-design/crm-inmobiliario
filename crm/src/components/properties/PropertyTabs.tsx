"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PropertyTabsProps {
  datos: ReactNode;
  galeria: ReactNode;
  visitas: ReactNode;
}

/**
 * Tabs de la ficha de propiedad (Task 10 Step 2): Datos / Galeria / Visitas.
 * Recibe el contenido ya montado desde el Server Component; `keepMounted`
 * en Galeria conserva su estado local optimista al cambiar de pestana.
 */
export function PropertyTabs({ datos, galeria, visitas }: PropertyTabsProps) {
  return (
    <Tabs defaultValue="datos">
      <TabsList aria-label="Secciones de la ficha">
        <TabsTrigger value="datos">Datos</TabsTrigger>
        <TabsTrigger value="galeria">Galería</TabsTrigger>
        <TabsTrigger value="visitas">Visitas</TabsTrigger>
      </TabsList>
      <TabsContent value="datos">{datos}</TabsContent>
      <TabsContent value="galeria" keepMounted>
        {galeria}
      </TabsContent>
      <TabsContent value="visitas">{visitas}</TabsContent>
    </Tabs>
  );
}
