# OPERATIONS — CRM Inmobiliario

Runbook post-MVP `v1.0-gates-pass` (26-08-2026). Prod: Supabase `phvirucslmmnkrcebtas` + Vercel `crm-inmobiliario-phi-two.vercel.app`.
Stack: Next 16 / React 19 / Supabase Postgres+RLS+Auth+Storage / Resend.

---

## 1. Roles y acceso

| Rol | `profiles.role` | `agency_id` | Ve |
|---|---|---|---|
| super_admin | `super_admin` | `null` | Todo vía `/maestro`; opera sobre una agencia solo suplantando |
| admin agencia | `admin` | `uuid agencia` | Su agencia (propiedades/contactos/deals/actividades/ajustes) |
| agent | `agent` | `uuid agencia` | Su agencia (sin `/ajustes?tab=usuarios` si se restringe) |

`super_admin` sin suplantar no tiene agencia efectiva: cualquier action de agencia responde “No tienes ninguna agencia activa” — es correcto.

---

## 2. Onboarding — alta de inmobiliaria cliente

Requiere sesión `super_admin`.

1. **Crear agencia**: `/maestro` → **Nueva agencia** → nombre, slug (auto si vacío), logo, color, SLA, días por etapa, formulario. Queda `active=true`.
2. **Suplantar**: `/maestro` → **Suplantar** en la fila → banner ámbar `Estás viendo {agencia} · Salir` (audita `impersonation_logs`).
3. **Invitar admin**: `/ajustes?tab=usuarios` → **Invitar usuario** → nombre, email, rol `Administrador` → **Crear invitación**. La cuenta queda confirmada, vinculada y con rol, pero **sin contraseña y sin email**.
4. **Salir** del banner antes de seguir.
5. **Primer acceso del invitado** (dos vías):
   - **Enlace mágico (recomendado)**: `https://TU-DOMINIO/login?agencia={slug}` → “Recibir enlace mágico” (requiere SMTP Supabase operativo; recomendado SMTP propio).
   - **Contraseña**: Supabase Dashboard → Authentication → Users → usuario → **Send password recovery** → fija pwd → login email+pwd.
6. **Captación web**: con el admin del cliente o suplantando, `/ajustes?tab=captacion` → activar → copiar iframe:
   ```html
   <iframe src="https://TU-DOMINIO/form/{slug}" style="width:100%;height:640px;border:0;border-radius:12px"></iframe>
   ```
   En la web pública del cliente: `<a href="https://TU-DOMINIO/login?agencia={slug}">Admin</a>` en footer/zona privada.

> Demo/E2E en prod: `demo` (`084d29a0…`/`#2563eb`), `Inmobiliaria Sur` (`e9ea365d…`/`inmobiliaria-sur`/`#dc2626`). E2E usa `admin@demo.es/Demo1234!` (`4cb5e29a…`). No borres estas si mantienes smoke.

---

## 3. Offboarding / desactivar / reactivar

- **Desactivar**: `/maestro` → toggle **Activa** o SQL `update agencies set active=false where slug='x'`. Efectos: `get_public_branding` no la expone, `GET /login?agencia=x` → “Esta agencia no está disponible”, `POST /api/public/leads/x` → 404 `Formulario no disponible`, `GET /form/x` → 200 `UnavailableView`, sesiones vivas de esa agencia redirigen a `/login?error=agencia` (banner `AGENCY_UNAVAILABLE`), E2E la detecta.
- **Reactivar**: mismo toggle o `active=true`. Verificar: `GET /form/x` vuelve a formulario, `POST /api/public/leads/x` 201.
- **Borrado**: no hay borrado en UI (FK). Si hace falta, anonimizar y `active=false`.

---

## 4. Suplantación (impersonation)

Solo `super_admin`. Dura hasta **Salir** o expiración de sesión. Todo el shell muestra banner ámbar. Durante suplantación:
- `/maestro` redirige a `/dashboard` (bloqueado a propósito).
- Listados (`/propiedades`, `/contactos`, `/pipeline`) filtran por `get_my_agency_id()` = agencia suplantada (RLS + filtro app `aa4990c`/`0002_fix_super_admin_rls.sql`).
- Direct fetch `/propiedades/{id-otra-agencia}` → 404 (detail `return null`).
- Auditoría: `select * from impersonation_logs order by started_at desc limit 20;` (`started`/`ended`).

---

## 5. Monitor y alertas

| Señal | Dónde | Qué mirar | Acción |
|---|---|---|---|
| Errores app | Vercel → Deployments → Logs / Runtime Logs | `500` en `/api/public/leads`, `NEXT_PUBLIC_SUPABASE_*` undefined, `service_role` leaked | Rollback deploy, rotar key |
| Auth | Supabase → Auth → Logs | magic link no llega, `Site URL`/`Redirect` mismatch | Ver paso 1.5 de README; SMTP propio |
| BD | Supabase → Database → Table Editor / SQL Editor | `agencies.active`, `properties` count, `impersonation_logs` | `select slug,active from agencies;` |
| Storage | Supabase → Storage | buckets `property-images`/`branding` públicos | Recrear si 403 |
| Email leads | Resend Dashboard | `RESEND_API_KEY` ausente → best-effort sin envío (lead sí se guarda) | Definir `LEADS_EMAIL_FROM` con dominio verificado |
| Web Vitals/500 | Vercel Analytics / Speed Insights | picos tras deploy | Comparar tag previo |

Sin paging dedicado aún: revisa Vercel+Supabase tras cada deploy y semanal.

---

## 6. Backups y restore

- **Supabase**: Project → Database → Backups (PITR según plan). Para export lógico:
  ```sql
  -- agencias + usuarios (sin PII sensible más allá de email)
  copy (select * from agencies) to stdout csv header;
  copy (select p.id, u.email, p.role, p.agency_id from profiles p join auth.users u on u.id=p.id) to stdout csv header;
  ```
- **Storage**: `property-images`/`branding` versionado no nativo — descarga periódica vía `supabase storage` o Dashboard.
- **Restore parcial demo**: `crm/supabase/demo-data.sql` (idempotente) recrea `PRO-0001..0005`/`SUR-0001` con imágenes Pexels; `seed.sql` solo `demo`.
- **Migrations**: orden canónico `0001_schema.sql` → `0002_fix_super_admin_rls.sql` → `seed.sql` (opcional) → `demo-data.sql` (opcional). Nunca reejecutar `0001` entero en prod con datos: aplicar diffs.

---

## 7. Despliegues y updates

- **Vercel** importa con **Root Directory `crm`**; auto-deploy en push a `master`. Env prod en Vercel → Settings → Env Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo server), `NEXT_PUBLIC_APP_URL` (canónico, hoy no leído pero debe coincidir con Supabase Site URL), `RESEND_API_KEY`/`LEADS_EMAIL_FROM` opcionales.
- **Pre-deploy**: `npm run lint` (0 err), `npm test -- --run` (463/35), `npm run build`, `npm run test:e2e` ×2 si toca flujo comercial.
- **Tagging**: `git tag -a v1.x -m "..." && git push --follow-tags`. Release actual: `v1.0-gates-pass`.
- **Hotfix RLS/migration**: pegar SQL en Supabase SQL Editor, verificar con `anon` vs `service_role` (ver `crm/supabase/VERIFY.md` §REST).

---

## 8. Incidentes comunes

| Síntoma | Causa | Fix |
|---|---|---|
| “No tienes ninguna agencia activa” siendo super_admin | No estás suplantando | `/maestro` → Suplantar |
| “Esta agencia no está disponible” en login | `agencies.active=false` o slug mal | `update agencies set active=true where slug='x'` |
| `/maestro` redirige a `/dashboard` | Estás suplantando (bloqueo intencional) | Salir del banner |
| Foto no carga / 403 Storage | Bucket no público o RLS | Storage → bucket → Public; re-aplicar sección 7 de `0001` |
| Magic link no llega | SMTP compartido limitado / Redirect URL mal | Supabase Auth → URL Config + SMTP propio |
| Lead 400 `companyUrl` | Honeypot disparado (bot) | Ignorar (200 honeypot filtra) |
| Lead 429 | Rate limit público | Reintentar 60s |
| `middleware` deprecation warn en build | Next 16 `middleware→proxy` | No bloquea; migrar con codemod cuando toque |

---

## 9. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` nunca en cliente; solo `route handlers`/`server actions` con guards (`requireAgency`, `resolveActor`).
- RLS `agency_isolation` en `properties/contacts/deals/activities/property_images` = `agency_id = get_my_agency_id() OR (is_super_admin() AND get_my_agency_id() IS NULL)` (`0002`). Filtro app redundante en `crm/src/lib/queries/*`.
- `.env.local` y `SUPABASE_SERVICE_ROLE_KEY` fuera de git (`.gitignore`). Rotar si se expone.

---

## 10. Contacto operativo

- Repo: `https://github.com/peterfoxx93-design/crm-inmobiliario` (`C:\Users\Pedro\CRM OC\crm inmobiliario`)
- Prod: `https://crm-inmobiliario-phi-two.vercel.app` (`/login?agencia=demo`, `/form/{slug}`, `POST /api/public/leads/{slug}`)
- Supabase: `phvirucslmmnkrcebtas` (ver `crm/.env.local` y `crm/supabase/VERIFY.md`)
- Super_admin bootstrap: `peterfoxx93@gmail.com` (`ca47523c…`), `admin@demo.es` (`4cb5e29a…`), `sur@demo.es` (`57b403ef…`)
