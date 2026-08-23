import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/EmptyState";

export const metadata: Metadata = {
  title: "Dashboard · CRM Inmobiliario",
};

/** Placeholder del Dashboard (Task 7). */
export default function DashboardPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Dashboard</h1>
      <EmptyState description="El panel con métricas y actividad reciente llegará en las próximas iteraciones." />
    </>
  );
}
