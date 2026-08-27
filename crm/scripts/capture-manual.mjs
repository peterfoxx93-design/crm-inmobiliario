import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD = "https://crm-inmobiliario-phi-two.vercel.app";
const OUT = join(__dirname, "..", "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const FINCAS = { slug: "fincas-mediterraneo", email: "admin@fincas-mediterraneo.es", pass: "Mediterraneo2026!" };
const PETER = { slug: "demo", email: "peterfoxx93@gmail.com", pass: "Blujean9762#" };
const VILLA_ID = "92286ae5-1dc2-4e97-b1db-0ee632595e2c";

async function login(page, { slug, email, pass }) {
  await page.goto(`${PROD}/login?agencia=${slug}`, { waitUntil: "domcontentloaded" });
  // wait for branding or form
  await page.waitForTimeout(2500);
  // email input should appear when branding loaded
  const emailInput = page.locator("#email");
  await emailInput.waitFor({ timeout: 15000 });
  await emailInput.fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/dashboard|\/maestro/, { timeout: 15000 }).catch(()=>{});
  await page.waitForTimeout(1500);
}

async function shot(page, name, opts={}) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false, ...opts });
  console.log("✓", name);
}

const browser = await chromium.launch({ headless: true });

try {
  // 1. login-branding (no auth, fincas)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "es-ES" });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/login?agencia=${FINCAS.slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "login-branding.png", { fullPage: true });
    await shot(page, "login-magic-link.png", { fullPage: true });
    await ctx.close();
  }

  // 2. fincas desktop flow
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
    const page = await ctx.newPage();
    await login(page, FINCAS);

    await page.goto(`${PROD}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "dashboard.png", { fullPage: true });
    await shot(page, "sidebar-desktop.png", { fullPage: false });

    // mapa modulos - reuse dashboard
    await shot(page, "mapa-modulos.png", { fullPage: true });

    await page.goto(`${PROD}/propiedades`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shot(page, "properties-list.png", { fullPage: true });

    await page.goto(`${PROD}/propiedades/nuevo`, { waitUntil: "networkidle" });
    await shot(page, "property-new-form.png", { fullPage: true });

    await page.goto(`${PROD}/propiedades/${VILLA_ID}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    // click Galería
    const gal = page.getByRole("tab", { name: "Galería" });
    if (await gal.count() > 0) { await gal.click(); await page.waitForTimeout(800); }
    await shot(page, "property-gallery-upload.png", { fullPage: true });

    await page.goto(`${PROD}/contactos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, "contacts-list.png", { fullPage: true });

    // drawer: click first row
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(1200);
      await shot(page, "contact-drawer.png", { fullPage: false });
      // close drawer with Esc
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } else {
      // fallback: screenshot whole page as drawer placeholder
      await shot(page, "contact-drawer.png", { fullPage: true });
    }

    await page.goto(`${PROD}/pipeline`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, "pipeline-kanban.png", { fullPage: true });

    await page.goto(`${PROD}/agenda`, { waitUntil: "networkidle" });
    await shot(page, "agenda-list.png", { fullPage: true });

    await page.goto(`${PROD}/ajustes?tab=branding`, { waitUntil: "networkidle" });
    await shot(page, "settings-branding.png", { fullPage: true });

    await page.goto(`${PROD}/ajustes?tab=usuarios`, { waitUntil: "networkidle" });
    await shot(page, "settings-invite.png", { fullPage: true });

    await page.goto(`${PROD}/ajustes?tab=captacion`, { waitUntil: "networkidle" });
    await shot(page, "settings-captacion.png", { fullPage: true });

    await ctx.close();
  }

  // 3. mobile bottom-tab
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 819 }, isMobile: true, hasTouch: true, locale: "es-ES" });
    const page = await ctx.newPage();
    await login(page, FINCAS);
    await page.goto(`${PROD}/dashboard`, { waitUntil: "networkidle" });
    await shot(page, "bottom-tab-mobile.png", { fullPage: false });
    await ctx.close();
  }

  // 4. peter maestro + impersonation banner
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
    const page = await ctx.newPage();
    await login(page, PETER);
    await page.goto(`${PROD}/maestro`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, "maestro-new-agency.png", { fullPage: true });

    // click Suplantar on fincas row
    const suplantar = page.getByRole("button", { name: "Suplantar" }).first();
    if (await suplantar.count() > 0) {
      await suplantar.click();
      await page.waitForTimeout(1500);
      // should be on dashboard with banner
      await page.goto(`${PROD}/dashboard`, { waitUntil: "networkidle" });
      await shot(page, "impersonation-banner.png", { fullPage: false });
      // Also sidebar with banner
      await shot(page, "sidebar-desktop-impersonating.png", { fullPage: false });
    }
    await ctx.close();
  }

  // 5. form public (no auth)
  {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 900 }, locale: "es-ES" });
    const page = await ctx.newPage();
    await page.goto(`${PROD}/form/${FINCAS.slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await shot(page, "form-public.png", { fullPage: true });
    await ctx.close();
  }

  console.log("DONE ->", OUT);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
