# Verificación del esquema de base de datos

Proyecto Supabase: `phvirucslmmnkrcebtas` (URL en `crm/.env.local`).

No hay CLI ni `psql` disponibles: la ejecución se hace pegando SQL en el
Dashboard. Sigue los pasos **EN ORDEN**.

---

## Paso A · Esquema completo

1. Abre el Dashboard del proyecto → **SQL Editor**.
2. **New query**.
3. Pega TODO el contenido de `crm/supabase/migrations/0001_schema.sql`.
4. Pulsa **Run**.

Resultado esperado: `Success. No rows returned` (sin errores).

> ⚠️ Si falla al final en el bloque de Storage con un error de permisos sobre
> `storage.buckets`: crea manualmente los buckets **property-images** y
> **branding** en **Dashboard → Storage → New bucket**, marcándolos como
> **Public**, y vuelve a pegar solo la sección 7 (Storage) del archivo.

## Paso B · Seed

1. En **SQL Editor**, **New query** otra vez.
2. Pega TODO el contenido de `crm/supabase/seed.sql`.
3. Pulsa **Run**.

Resultado esperado: `INSERT 0 1` (o `INSERT 0 0` si ya existía la agencia demo).

## Paso C · Bootstrap del super_admin (tu usuario)

1. Ve a **Authentication → Users** y pulsa **Add user**:
   - Email y contraseña: TU email real y una contraseña segura.
   - Marca **Auto Confirm User** (equivale a confirmar el email).
   - Al crearlo, el trigger `on_auth_user_created` inserta tu perfil con rol `agent`.
2. Vuelve a **SQL Editor** y ejecuta (sustituye `<tu-email>` y `<tu nombre>`):

```sql
insert into public.profiles (id, agency_id, role, full_name)
select id, null, 'super_admin', '<tu nombre>'
from auth.users where email = '<tu-email>';
```

> ⚠️ Si falla con `duplicate key value violates unique constraint "profiles_pkey"`:
> es esperable — el trigger ya creó tu perfil al añadir el usuario. En ese caso
> ejecuta esta versión equivalente:

```sql
update public.profiles
set role = 'super_admin', agency_id = null
where id = (select id from auth.users where email = '<tu-email>');
```

3. Comprueba: `select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;`
   → tu fila debe tener `role = super_admin`.

## Paso D · Verificación final

En **SQL Editor**:

```sql
select * from agencies;
```

Debe devolver **la fila demo**: `slug = demo`, `primary_color = #2563eb`,
`settings` con `sla_lead_hours: 24` y `pipeline_stage_days`.

### Verificación opcional por REST (aislamiento RLS)

Con las claves de `crm/.env.local` (**NO las pegues en repos ni las compartas**):

- Con `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sin login) — RLS bloquea al anon:

```powershell
$headers = @{ apikey = "$env:NEXT_PUBLIC_SUPABASE_ANON_KEY"; Authorization = "Bearer $env:NEXT_PUBLIC_SUPABASE_ANON_KEY" }
Invoke-RestMethod -Uri "https://phvirucslmmnkrcebtas.supabase.co/rest/v1/agencies" -Headers $headers
```

Esperado: lista vacía `[]`.

- Con `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca en cliente) — salta RLS:

```powershell
$headers = @{ apikey = "$env:SUPABASE_SERVICE_ROLE_KEY"; Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY" }
Invoke-RestMethod -Uri "https://phvirucslmmnkrcebtas.supabase.co/rest/v1/agencies" -Headers $headers
```

Esperado: un array con la agencia demo.

### Checklist rápida

- [ ] Paso A sin errores
- [ ] Buckets `property-images` y `branding` existen y son públicos
- [ ] Paso B inserta la agencia demo
- [ ] Tu perfil existe con rol `super_admin`
- [ ] `select * from agencies;` devuelve la fila demo
- [ ] REST anon devuelve `[]`; REST service_role devuelve la fila demo
- [ ] Login en la app (`npm run dev` en `crm/`) crea sesión y ve su perfil

---

## Paso E · Runbook E2E (Playwright)

Requisito: BD migrada (pasos A-B) y buckets creados.

1. Crear usuario demo `admin@demo.es` / `Demo1234!` / agencia `demo` (parametrizable `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_AGENCY`):
   - Authentication → Users → Add user: `admin@demo.es`, `Demo1234!`, Auto Confirm.
   - SQL Editor:
     ```sql
     update public.profiles set agency_id=(select id from agencies where slug='demo')
     where id=(select id from auth.users where email='admin@demo.es');
     ```
2. `npm run build` (webServer usa `next start`, no dev).
3. `npx playwright install chromium`.
4. `npm run test:e2e` — repetir 2× consecutivas; gate = PASS ×2 (datos con sufijo timestamp, no colisionan). Verificado 26-08: 32.4s/25.0s + 27.1s/24.4s.
