import { defineConfig } from "@playwright/test";

/**
 * Configuracion E2E smoke (Task 19).
 *
 * Estrategia de servidor: `next start` sobre una build previa
 * (`npm run build` antes de `npm run test:e2e`). Es la variante mas estable
 * para un flujo serial con estado (sin recompilacion on-demand del dev server).
 * Si prefieres el dev server: levantalo a mano (`npm run dev`) antes de lanzar
 * los tests; `reuseExistingServer` lo reutilizara tal cual.
 *
 * El flujo es ESTADO (crea propiedad/contacto/oferta en la agencia demo):
 * - `fullyParallel: false` + `workers: 1`: un solo navegador ejecuta el
 *   recorrido completo sin interferencias.
 * - Cada proyecto (desktop/mobile) repite el flujo con datos sufijados por
 *   timestamp, por lo que ambas pasadas conviven en la misma BD.
 */
export default defineConfig({
  testDir: "./src/e2e",
  // Solo specs de Playwright (*.spec.ts); los *.test.ts son de Vitest y no
  // deben cargarse aqui (su import de "vitest" rompe el runner).
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 819 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
