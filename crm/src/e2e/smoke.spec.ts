import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

/**
 * Smoke E2E del flujo comercial completo (Task 19), 100% en espanol.
 *
 * Recorrido: login admin demo -> crear propiedad con foto -> activarla ->
 * crear contacto -> registrar llamada -> crear oferta -> cerrar el deal como
 * ganado -> marcar la propiedad vendida -> dashboard con KPIs.
 *
 * Selectores fundamentados en el codigo real:
 * - Login: src/components/auth/LoginForm.tsx (#agencia, #email, #password).
 * - Alta propiedad: src/components/properties/PropertyForm.tsx
 *   (FormControl con label asociado; selects de Operacion/Tipo sin id ->
 *   [data-slot="select-trigger"] por orden, ver ui/select.tsx).
 * - Galeria: src/components/properties/GalleryManager.tsx
 *   (input file sr-only aria-label "Subir imagenes", asa "Reordenar imagen N").
 * - Tabs ficha: src/components/properties/PropertyTabs.tsx (rol tab).
 * - Estados: src/components/properties/StatusActions.tsx ("Cambiar estado").
 * - Contactos: src/components/contacts/NewContactButton.tsx +
 *   ContactProfileForm.tsx (#contact-*) y ContactsTable.tsx
 *   (dropdown aria-label "Acciones de {nombre}" -> "Abrir ficha").
 * - Drawer 360: src/components/contacts/ContactDrawer.tsx + QuickActions.tsx
 *   (botones Llamada / Oferta).
 * - Actividad: src/components/shared/ActivityComposer.tsx (#activity-title).
 * - Oferta: src/components/contacts/DealCreateDialog.tsx
 *   (#offer-property, #offer-value).
 * - Pipeline: src/components/pipeline/KanbanBoard.tsx + KanbanCard.tsx
 *   (boton aria-label "Abrir oferta de {contacto}") y DealDrawer.tsx
 *   ("Marcar ganado" -> ConfirmDialog "Si, marcar ganada" -> aviso
 *   "Marcar propiedad como vendida"). Se usa el camino del drawer, que es
 *   determinista en Playwright a diferencia del drag & drop de dnd-kit.
 * - Dashboard: src/components/dashboard/KpiCards.tsx
 *   (seccion aria-label "Indicadores clave", tarjeta "Leads nuevos (7 dias)").
 */

// --- Credenciales parametrizables (ver RUNBOOK en task-19-report.md) ---

const E2E_EMAIL = process.env.E2E_EMAIL ?? "admin@demo.es";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Demo1234!";
const E2E_AGENCY = process.env.E2E_AGENCY ?? "demo";

/** Sufijo unico por ejecucion: dos pasadas seguidas conviven en la misma BD. */
const STAMP = Date.now().toString(36);
const PROPERTY_TITLE = `Piso E2E ${STAMP}`;
const CONTACT_NAME = `Cliente E2E ${STAMP}`;
const CALL_TITLE = `Llamada E2E ${STAMP}`;
const OFFER_VALUE = "240000";

/** PNG 1x1 valido (evita fixtures binarios en el repo). */
const FOTO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Abre el popup del Select de Base UI y pulsa la opcion cuyo texto contenga
 * `etiqueta`. Los popups se portan a un portal: se busca por
 * [data-slot="select-content"] (ui/select.tsx).
 */
async function elegirOpcion(page: Page, trigger: Locator, etiqueta: string) {
  await trigger.click();
  await page
    .locator('[data-slot="select-content"] [data-slot="select-item"]')
    .filter({ hasText: etiqueta })
    .first()
    .click();
}

test.describe.configure({ mode: "serial" });

test.describe("Flujo comercial completo", () => {
  test("login, propiedad con foto, contacto, llamada, oferta ganada y KPIs", async ({
    page,
  }) => {
    // --- 1. Login del admin de la agencia demo ---------------------------
    // LoginForm.tsx: paso 1 slug (?agencia= lo auto-resuelve el servidor),
    // paso 2 credenciales #email/#password con boton "Iniciar sesion".
    await page.goto(`/login?agencia=${E2E_AGENCY}`);
    await expect(
      page.getByRole("heading", { name: "Inicia sesión" }),
    ).toBeVisible();

    await page.getByLabel("Correo electrónico").fill(E2E_EMAIL);
    await page.getByLabel("Contraseña").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // auth.ts DEFAULT_LOGIN_REDIRECT = "/dashboard".
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    // --- 2. Crear propiedad ----------------------------------------------
    // propiedades/page.tsx: CTA cabecera "Nueva propiedad" -> /propiedades/nuevo.
    await page.goto("/propiedades");
    await page.getByRole("link", { name: "Nueva propiedad" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Nueva propiedad" }),
    ).toBeVisible();

    await page.getByLabel("Título").fill(PROPERTY_TITLE);

    // PropertyForm.tsx: los selects Operacion/Tipo no llevan id; dentro del
    // form el orden es determinista (0 = Operacion, 1 = Tipo).
    const triggers = page.locator('form [data-slot="select-trigger"]');
    await elegirOpcion(page, triggers.nth(0), "Venta");
    await elegirOpcion(page, triggers.nth(1), "Piso");

    await page.getByLabel("Precio (EUR)").fill(OFFER_VALUE);
    await page.getByLabel("Habit.").fill("2");
    await page.getByLabel("Baños").fill("1");
    await page.getByLabel("m²").fill("80");
    await page.getByLabel("Ciudad").fill("Madrid");
    await page.getByLabel("Zona").fill("Chamberí");

    await page.getByRole("button", { name: "Crear propiedad" }).click();

    // PropertyForm onSubmit: router.push(`/propiedades/${id}`); la cabecera
    // de la ficha muestra el titulo y StatusBadge "Borrador".
    await page.waitForURL(/\/propiedades\/[^/]+$/);
    const propertyUrl = new URL(page.url()).pathname;
    await expect(
      page.getByRole("heading", { name: PROPERTY_TITLE }),
    ).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

    // --- 3. Subir foto (tab Galeria) --------------------------------------
    // PropertyTabs.tsx: trigger rol tab "Galeria". GalleryManager.tsx:
    // input file oculto con aria-label "Subir imagenes"; al acabar pinta la
    // miniatura con asa "Reordenar imagen 1".
    await page.getByRole("tab", { name: "Galería" }).click();
    await page
      .locator('input[type="file"][aria-label="Subir imágenes"]')
      .setInputFiles({
        name: "foto-e2e.png",
        mimeType: "image/png",
        buffer: FOTO_PNG,
      });
    await expect(
      page.getByRole("button", { name: "Reordenar imagen 1" }),
    ).toBeVisible();

    // --- 4. Activar la propiedad ------------------------------------------
    // StatusActions.tsx: dropdown "Cambiar estado" ->
    // "Marcar como activo" (label en minusculas) -> badge Activo tras refresh.
    await page.getByRole("button", { name: "Cambiar estado" }).click();
    await page.getByRole("menuitem", { name: "Marcar como activo" }).click();
    await expect(page.getByText("Activo", { exact: true })).toBeVisible();

    // --- 5. Crear contacto ---------------------------------------------------
    // NewContactButton.tsx abre el dialogo con ContactProfileForm (#contact-*).
    await page.goto("/contactos");
    await page.getByRole("button", { name: "Nuevo contacto" }).click();

    const nuevoContactoDialog = page.getByRole("dialog", {
      name: "Nuevo contacto",
    });
    await expect(nuevoContactoDialog).toBeVisible();

    await nuevoContactoDialog.getByLabel("Nombre completo").fill(CONTACT_NAME);
    await nuevoContactoDialog.getByLabel("Teléfono").fill("+34 600 123 456");
    await nuevoContactoDialog
      .getByLabel("Email")
      .fill(`cliente.${STAMP}@e2e.demo`);
    await nuevoContactoDialog
      .getByLabel("Presupuesto máx. (EUR)")
      .fill(OFFER_VALUE);

    await nuevoContactoDialog
      .getByRole("button", { name: "Crear contacto" })
      .click();

    // El dialogo se cierra y la tabla se refresca con la fila nueva.
    await expect(nuevoContactoDialog).toBeHidden();
    await expect(page.getByRole("cell", { name: CONTACT_NAME })).toBeVisible();

    // --- 6. Abrir ficha 360 y registrar una llamada ---------------------------
    // ContactsTable.tsx: dropdown por fila "Acciones de {nombre}" ->
    // menuitem "Abrir ficha" monta ContactDrawer.
    await page
      .getByRole("button", { name: `Acciones de ${CONTACT_NAME}` })
      .click();
    await page.getByRole("menuitem", { name: "Abrir ficha" }).click();

    const drawerContacto = page.getByRole("dialog", { name: CONTACT_NAME });
    await expect(drawerContacto).toBeVisible();

    // QuickActions.tsx: boton "Llamada" abre ActivityComposer type="llamada".
    await drawerContacto.getByRole("button", { name: "Llamada" }).click();

    const composer = page.getByRole("dialog", {
      name: "Nueva actividad · Llamada",
    });
    await expect(composer).toBeVisible();
    await composer.getByLabel("Título").fill(CALL_TITLE);
    await composer.getByRole("button", { name: "Registrar" }).click();

    // Al guardar el composer se cierra y el historial se recarga mostrando
    // la actividad nueva (ContactDrawer reload por fetchKey).
    await expect(composer).toBeHidden();
    await expect(drawerContacto.getByText(CALL_TITLE)).toBeVisible();

    await drawerContacto.getByRole("button", { name: "Cerrar" }).click();
    await expect(drawerContacto).toBeHidden();

    // --- 7. Crear oferta sobre la propiedad -----------------------------------
    // QuickActions.tsx: boton "Oferta" abre DealCreateDialog (#offer-property,
    // #offer-value); las opciones listan "{referencia} · {titulo}".
    await page
      .getByRole("button", { name: `Acciones de ${CONTACT_NAME}` })
      .click();
    await page.getByRole("menuitem", { name: "Abrir ficha" }).click();
    await expect(drawerContacto).toBeVisible();

    await drawerContacto.getByRole("button", { name: "Oferta" }).click();

    const ofertaDialog = page.getByRole("dialog", { name: "Nueva oferta" });
    await expect(ofertaDialog).toBeVisible();

    await elegirOpcion(
      page,
      ofertaDialog.getByLabel("Propiedad"),
      PROPERTY_TITLE,
    );
    await ofertaDialog.getByLabel("Importe (EUR)").fill(OFFER_VALUE);
    await ofertaDialog.getByRole("button", { name: "Crear oferta" }).click();
    await expect(ofertaDialog).toBeHidden();

    await drawerContacto.getByRole("button", { name: "Cerrar" }).click();
    await expect(drawerContacto).toBeHidden();

    // --- 8. Pipeline: la oferta esta en "Nuevo lead" ---------------------------
    // KanbanCard.tsx: cada card es un boton aria-label
    // "Abrir oferta de {contacto}".
    await page.goto("/pipeline");
    const cardOferta = page.getByRole("button", {
      name: `Abrir oferta de ${CONTACT_NAME}`,
    });
    await expect(cardOferta).toBeVisible();

    // --- 9. Ganar la oferta desde el drawer ------------------------------------
    // Camino determinista (sin drag & drop): abrir drawer ->
    // "Marcar ganado" -> ConfirmDialog "Si, marcar ganada".
    await cardOferta.click();

    const drawerDeal = page.getByRole("dialog", { name: CONTACT_NAME });
    await expect(drawerDeal).toBeVisible();

    await drawerDeal.getByRole("button", { name: "Marcar ganado" }).click();

    const confirmGanada = page.getByRole("dialog", {
      name: "¿Marcar la oferta como ganada?",
    });
    await confirmGanada
      .getByRole("button", { name: "Sí, marcar ganada" })
      .click();

    // handleWon mantiene el drawer abierto: el boton pasa a "Ganada"
    // deshabilitado y aparece el aviso para vender la propiedad.
    await expect(confirmGanada).toBeHidden();
    await expect(
      drawerDeal.getByRole("button", { name: "Ganada" }),
    ).toBeDisabled();

    // --- 10. Confirmar propiedad vendida ----------------------------------------
    // DealDrawerBody: aviso ambar "Marcar propiedad como vendida" llama a
    // setPropertyStatus(id, "vendido"); al exito el aviso desaparece.
    await drawerDeal
      .getByRole("button", { name: "Marcar propiedad como vendida" })
      .click();
    await expect(
      drawerDeal.getByRole("button", {
        name: "Marcar propiedad como vendida",
      }),
    ).toBeHidden();

    // La ficha refleja el estado final "Vendido" (StatusBadge en cabecera).
    await page.goto(propertyUrl);
    await expect(page.getByText("Vendido", { exact: true })).toBeVisible();

    // La oferta cerrada desaparece del pipeline.
    await page.goto("/pipeline");
    await expect(
      page.getByRole("button", {
        name: `Abrir oferta de ${CONTACT_NAME}`,
      }),
    ).toHaveCount(0);

    // --- 11. Dashboard con KPIs --------------------------------------------------
    // KpiCards.tsx: seccion "Indicadores clave"; la tarjeta "Leads nuevos
    // (7 dias)" debe ser >= 1 porque el contacto se creo hoy.
    // Nota: en una BD recien sembrada las demas tarjetas pueden quedar a 0
    // (la propiedad ya esta vendida, la visita no forma parte de este flujo
    // y la oferta cerrada sale del pipeline): solo se exige > 0 lo que el
    // propio recorrido garantiza.
    await page.goto("/dashboard");
    const kpis = page.getByRole("region", { name: "Indicadores clave" });
    await expect(kpis).toBeVisible();

    // Tarjeta = div.bg-card que contiene el titulo; el valor vive en
    // p.text-2xl (KpiCards.tsx).
    const leadsCard = kpis
      .locator("div.bg-card")
      .filter({ hasText: "Leads nuevos (7 días)" });
    const leadsValue = Number(
      (await leadsCard.locator("p.text-2xl").innerText()).trim(),
    );
    expect(leadsValue).toBeGreaterThanOrEqual(1);
  });
});
