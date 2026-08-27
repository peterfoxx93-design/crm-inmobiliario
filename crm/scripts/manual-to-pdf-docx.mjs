import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import MarkdownIt from "markdown-it";
import HTMLDocx from "html-docx-js";
import { chromium } from "playwright";
import { readFile } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");
const mdPath = join(root, "MANUAL_USUARIO.md");
const htmlPath = join(root, "docs", "MANUAL_USUARIO.html");
const pdfPath = join(root, "docs", "MANUAL_USUARIO.pdf");
const docxPath = join(root, "docs", "MANUAL_USUARIO.docx");
const screenshotsDir = join(root, "docs", "screenshots");

mkdirSync(join(root, "docs"), { recursive: true });

const md = readFileSync(mdPath, "utf8");
const mdit = new MarkdownIt({ html: true, linkify: true, typographer: true });
let htmlBody = mdit.render(md);

// Inline images as base64 for both PDF and DOCX portability
import { readdirSync } from "fs";
const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
let m;
const imageMap = new Map();
for (const file of readdirSync(screenshotsDir)) {
  if (!/\.(png|jpg|jpeg)$/i.test(file)) continue;
  const full = join(screenshotsDir, file);
  const b64 = readFileSync(full).toString("base64");
  const ext = file.endsWith(".png") ? "png" : "jpeg";
  imageMap.set(`docs/screenshots/${file}`, `data:image/${ext};base64,${b64}`);
  imageMap.set(`docs\\screenshots\\${file}`, `data:image/${ext};base64,${b64}`);
  imageMap.set(file, `data:image/${ext};base64,${b64}`);
}

// Replace src in htmlBody
htmlBody = htmlBody.replace(/src=["']([^"']+)["']/g, (full, src) => {
  const key = src.replace(/^\.\//, "").replace(/^\//, "");
  if (imageMap.has(key)) return `src="${imageMap.get(key)}"`;
  if (imageMap.has(src)) return `src="${imageMap.get(src)}"`;
  // try basename
  const base = src.split("/").pop().split("\\").pop();
  if (imageMap.has(base)) return `src="${imageMap.get(base)}"`;
  return full;
});

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CRM Inmobiliario — Manual de Usuario v1.0</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  :root{--brand:#2563eb;--bg:#F8F9FA;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--accent:#0ea5e9}
  *{box-sizing:border-box}
  html{font-size:11pt}
  body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--text);line-height:1.6;max-width:860px;margin:0 auto;padding:32px 28px;background:white}
  h1{font-size:26pt;font-weight:700;letter-spacing:-0.02em;margin:0 0 4px}
  h2{font-size:14pt;font-weight:700;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--border);color:#0f172a}
  h3{font-size:11pt;font-weight:700;margin:18px 0 8px;color:#1e293b}
  h4{font-size:10.5pt;font-weight:600;margin:14px 0 6px}
  p{margin:8px 0}
  a{color:var(--brand);text-decoration:none}
  a:hover{text-decoration:underline}
  blockquote{margin:10px 0;padding:10px 14px;border-left:4px solid var(--accent);background:#f0f9ff;color:#0c4a6e;border-radius:6px;font-size:10pt}
  blockquote p{margin:4px 0}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:9.5pt}
  pre{background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font-size:9pt;line-height:1.5}
  pre code{background:transparent;padding:0;color:inherit}
  table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:9.5pt}
  th{ background:#f8fafc;text-align:left;font-weight:600;padding:8px 10px;border:1px solid var(--border)}
  td{padding:7px 10px;border:1px solid var(--border);vertical-align:top}
  tr:nth-child(even) td{background:#fcfcfc}
  img{max-width:100%;height:auto;border:1px solid var(--border);border-radius:10px;box-shadow:0 2px 10px rgba(15,23,42,0.06);margin:10px 0 14px;display:block}
  hr{border:none;border-top:1px solid var(--border);margin:22px 0}
  .cover{padding:18px 20px;border:1px solid var(--border);border-radius:12px;background:linear-gradient(180deg,#ffffff,#f8fafc);margin-bottom:18px}
  .cover p{margin:3px 0;color:var(--muted);font-size:9.5pt}
  .badge{display:inline-block;background:var(--brand);color:white;padding:2px 8px;border-radius:999px;font-size:8.5pt;font-weight:600;letter-spacing:0.02em}
  ul,ol{margin:6px 0 10px 20px}
  li{margin:3px 0}
  @media print{body{padding:0} a{color:var(--brand)} img{break-inside:avoid} h2{break-after:avoid} table{break-inside:avoid}}
</style></head><body>
<div class="cover">
  <span class="badge">v1.0 · 27-08-2026 · Gates PASS</span>
  <h1>CRM Inmobiliario — Manual de Usuario</h1>
  <p><strong>Producción:</strong> https://crm-inmobiliario-phi-two.vercel.app · <strong>Supabase:</strong> phvirucslmmnkrcebtas</p>
  <p>Multi-agencia con aislamiento RLS · Next 16 + Supabase · 20 secciones · 11 capturas reales de prod (Fincas Mediterráneo)</p>
</div>
${htmlBody}
<hr><p style="text-align:center;color:#64748b;font-size:9pt;margin-top:18px">Fin del manual — MVP 1.0 cerrado 27-08-2026 · Soporte: peterfoxx93@gmail.com · Generado automáticamente con capturas Playwright</p>
</body></html>`;

writeFileSync(htmlPath, html, "utf8");
console.log("HTML ->", htmlPath);

// PDF via Playwright
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" } });
await browser.close();
console.log("PDF  ->", pdfPath, "(" + (readFileSync(pdfPath).length/1024).toFixed(1) + " KB)");

// DOCX via html-docx-js (expects full HTML doc)
const docxHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
const docxBuffer = HTMLDocx.asBlob(docxHtml); // returns blob in node? html-docx-js returns string/buffer
// In Node, asBlob returns buffer-like: we use write via its internal
import { writeFileSync as w } from "fs";
if (typeof docxBuffer === "string") {
  w(docxPath, Buffer.from(docxBuffer, "binary"));
} else if (docxBuffer instanceof Buffer) {
  w(docxPath, docxBuffer);
} else {
  // html-docx-js node path: it returns Buffer via _generate
  const b = await docxBuffer.arrayBuffer?.().then(ab=>Buffer.from(ab)).catch(()=>null);
  if (b) w(docxPath, b);
  else {
    // fallback: use the sync API via HTMLDocx.asBlob returns Uint8Array-ish
    const arr = docxBuffer;
    w(docxPath, Buffer.from(arr));
  }
}
console.log("DOCX ->", docxPath, "(" + (existsSync(docxPath) ? (readFileSync(docxPath).length/1024).toFixed(1)+" KB" : "0") + ")");
