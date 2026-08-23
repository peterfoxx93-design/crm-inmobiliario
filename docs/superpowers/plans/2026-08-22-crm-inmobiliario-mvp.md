# CRM Inmobiliario MVP — Plan de Implementación

> **Para agentes ejecutores:** REQUERIDO usar superpowers:subagent-driven-development o superpowers:executing-plans para implementar tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir el MVP multi-tenant del CRM Inmobiliario según el spec en `docs/superpowers/specs/2026-08-22-crm-inmobiliario-design.md`.

**Arquitectura:** Next.js 15 App Router + Supabase (Postgres/Auth/Storage) con aislamiento por `agency_id` mediante RLS. Branding dinámico por agencia vía CSS variables. Formulario público de captación embebible.

**Stack:** TypeScript strict - Tailwind CSS v4 - shadcn/ui - lucide-react - @supabase/ssr - react-hook-form + zod - @dnd-kit/core - TanStack Table - recharts - react-leaflet (OpenStreetMap) - date-fns - Vitest - Playwright - Resend (email) - Vercel.

## Restricciones globales

- UI 100% en español; moneda EUR (`formatCurrency` es-ES).
- RLS activa en TODAS las tablas de negocio; ninguna query de cliente salta el aislamiento.
- La clave `service_role` solo se usa en servidor (route handlers / server actions), nunca en cliente.
- Mapas OpenStreetMap/Leaflet (sin API keys de pago).
- Cada tarea termina en commit convencional (`feat:` `fix:` `test:` `chore:`).
- Responsive mobile-first: sidebar desktop, bottom-tab bar + FAB en móvil.
- Paleta operativa: verde=activo/cerrado, ambar=reservado/pendiente, rojo=alerta SLA, gris=borrador.
- Tipografia Inter; fondos neutros #F8F9FA; miniaturas 16:9; skeleton screens en cargas.

## Estructura de archivos destino

```
crm/
  supabase/
    migrations/0001_schema.sql     (esquema + RLS + triggers)
    seed.sql                       (agencia demo)
  src/
    app/
      login/page.tsx
      form/[slug]/page.tsx
      api/public/leads/[slug]/route.ts
      (app)/
        layout.tsx                 (shell sidebar + topbar)
        dashboard/page.tsx
        propiedades/page.tsx  propiedades/[id]/page.tsx
        contactos/page.tsx
        pipeline/page.tsx
        agenda/page.tsx
        ajustes/page.tsx
        maestro/page.tsx           (super_admin)
      actions/                     (server actions por modulo)
    components/
      ui/                          (shadcn)
      layout/                      (Sidebar, Topbar, BottomBar, Fab)
      properties/ contacts/ pipeline/ agenda/ dashboard/ maestro/
      shared/                      (DataTable, Drawer, StatusBadge, EmptyState)
    lib/
      supabase/client.ts server.ts middleware.ts
      utils.ts format.ts constants.ts types.ts
      validators/                  (zod schemas)
    tests/unit/                    (vitest)
    e2e/                           (playwright)
```

## FASE 0 — Fundación

### Task 1: Scaffold del proyecto

**Files:** Create: raíz del repo (package.json, src/, config).

- [ ] **Step 1:** Crear app Next.js en la carpeta del proyecto:
```bash
npx create-next-app@latest crm --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
- [ ] **Step 2:** Inicializar shadcn/ui y añadir componentes usados en TODO el MVP:
```bash
cd crm && npx shadcn@latest init -d
npx shadcn@latest add button card input label select dialog sheet dropdown-menu avatar badge tabs textarea checkbox table skeleton separator tooltip popover calendar form sonner command scroll-area progress
```
- [ ] **Step 3:** Dependencias:
```bash
npm i @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers @tanstack/react-table @dnd-kit/core @dnd-kit/sortable recharts date-fns leaflet react-leaflet resend
npm i -D vitest @playwright/test @types/leaflet
```
- [ ] **Step 4:** Configurar Vitest (`vitest.config.ts` con alias `@` -> `src`) y script `"test": "vitest run"`.
- [ ] **Step 5:** `git init`, `.gitignore` estándar de Next.js + `.env.local*`. Commit: `chore: scaffold next.js + tailwind + shadcn`.

### Task 2: Clientes Supabase y middleware de sesión

**Files:** Create: `src/lib/supabase/{client.ts,server.ts,middleware.ts}`, `src/middleware.ts`.

**Interfaces (producidas):**
- `createClient(): SupabaseClient` (browser, anon key)
- `createServerClient()` desde `server.ts`: cliente con cookies para Server Components/actions
- `updateSession(request)` en `middleware.ts`: refresca token y devuelve `{ response, user }`

- [ ] **Step 1:** Crear proyecto en supabase.com (región eu-west). Guardar en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=(se añade en Task 17)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
- [ ] **Step 2:** Implementar los 3 archivos según patrón oficial @supabase/ssr (cookies con `getAll/setAll`). El `middleware.ts` raíz protege todas las rutas salvo `/login`, `/form/*`, `/api/public/*`, assets: sin usuario -> redirect a `/login?next={path}`.
- [ ] **Step 3:** Verificar `npm run build` pasa. Commit: `feat: supabase clients y guard de sesion`.

### Task 3: Esquema de base de datos + RLS

**Files:** Create: `supabase/migrations/0001_schema.sql`, `supabase/seed.sql`. Ejecutar pegando el SQL en Supabase SQL Editor.

**Interfaces (producidas):** tablas y helpers que consumen TODAS las tareas siguientes.

- [ ] **Step 1:** Escribir y ejecutar el esquema completo:

```sql
create extension if not exists pgcrypto;

-- Helpers (security definer para evitar recursion en policies de profiles)
create or replace function public.get_my_agency_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(p.active_agency_id, p.agency_id)
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#2563eb',
  active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id),
  active_agency_id uuid references public.agencies(id), -- impersonacion super_admin
  role text not null check (role in ('super_admin','admin','agent')),
  full_name text not null,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  reference text not null,
  title text not null,
  description text,
  property_type text not null check (property_type in ('piso','casa','villa','terreno','local','oficina','otro')),
  operation text not null check (operation in ('venta','alquiler')),
  status text not null default 'borrador' check (status in ('borrador','activo','reservado','vendido','retirado')),
  price numeric(12,2) not null check (price >= 0),
  bedrooms int, bathrooms int, surface_m2 numeric(8,2),
  address text, city text, zone text,
  lat numeric(9,6), lng numeric(9,6),
  features text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, reference)
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  position int not null,
  unique (property_id, position)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_type text not null default 'comprador' check (contact_type in ('comprador','inquilino','propietario')),
  full_name text not null,
  email text, phone text not null,
  notes text,
  source text not null default 'manual' check (source in ('web','manual','referido','portal')),
  source_detail text,
  status text not null default 'nuevo' check (status in ('nuevo','en_seguimiento','calificado','descartado','cerrado')),
  budget_max numeric(12,2),
  preferences jsonb not null default '{}',
  consent_rgpd boolean not null default false,
  consent_at timestamptz,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  agent_id uuid not null references public.profiles(id),
  stage text not null default 'nuevo_lead' check (stage in ('nuevo_lead','calificado','visita','negociacion','cierre')),
  value numeric(12,2),
  notes text,
  won boolean,
  lost_reason text,
  stage_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  type text not null check (type in ('llamada','email','whatsapp','nota','visita','tarea','sistema')),
  title text not null,
  body text,
  due_date timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.impersonation_logs (
  id uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references public.profiles(id),
  target_agency_id uuid not null references public.agencies(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Trigger: nuevo usuario auth -> profile con metadata de invitacion
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, agency_id, role, full_name)
  values (
    new.id,
    (new.raw_user_meta_data->>'agency_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Trigger updated_at generico
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
-- aplicar a: agencies, profiles, properties, contacts, deals

-- Indices
create index idx_properties_agency_status on public.properties (agency_id, status);
create index idx_contacts_agency_status on public.contacts (agency_id, status);
create index idx_deals_agency_stage on public.deals (agency_id, stage);
create index idx_activities_contact on public.activities (contact_id, created_at desc);
create index idx_activities_due on public.activities (agency_id, due_date) where type = 'tarea';
```

- [ ] **Step 2:** Activar RLS y politicas. Patron por tabla de negocio (properties, property_images, contacts, deals, activities):
```sql
alter table public.properties enable row level security;
create policy "agency_isolation" on public.properties for all
using (agency_id = public.get_my_agency_id() or public.is_super_admin())
with check (agency_id = public.get_my_agency_id() or public.is_super_admin());
```
Excepciones: `profiles` -> select/update de perfiles de su agencia o propio (sin definer loop porque usa get_my_agency_id); admin puede actualizar rol/agencia de su agencia. `agencies` -> select solo de la propia agencia o super_admin; escritura solo super_admin. `impersonation_logs` -> select/insert solo super_admin.

- [ ] **Step 3:** Storage: buckets publicos `property-images` y `branding`; policies de escritura con carpeta prefijo `{agency_id}/`.
- [ ] **Step 4:** `seed.sql`: agencia demo slug `demo`, color #2563eb, settings `{"sla_lead_hours":24,"pipeline_stage_days":{"nuevo_lead":7,"calificado":7,"visita":10,"negociacion":14}}`. Bootstrap del primer super_admin: crear usuario propio desde Supabase Dashboard (Auth > Add user) y luego `insert into public.profiles (id, agency_id, role, full_name) select id, null, 'super_admin', '<tu nombre>' from auth.users where email = '<tu-email>';`
- [ ] **Step 5:** Verificacion manual en SQL Editor: `select * from public.agencies;` como anon devuelve 0 filas (RLS); como service_role devuelve la demo. Commit: `feat: schema multi-tenant con rls`.

### Task 4: Tipos, constantes y utilidades con tests

**Files:** Create: `src/lib/types.ts`, `src/lib/constants.ts`, `src/lib/format.ts`, `src/lib/reference.ts`, `src/tests/unit/*.test.ts`.

**Interfaces (producidas):**
- `type DealStage = 'nuevo_lead'|'calificado'|'visita'|'negociacion'|'cierre'`
- `DEAL_STAGES: {id: DealStage; label: string}[]` (Nuevo lead, Calificado, Visita, Negociacion, Cierre)
- `PROPERTY_STATUS_META: Record<PropertyStatus,{label,color}>` (borrador gris, activo verde, reservado ambar, vendido azul, retirado rojo tenue)
- `formatCurrency(n:number):string` (EUR es-ES), `formatDate(d:string|Date):string` (dd MMM yyyy)
- `buildReference(seq:number):string` -> `REF-` + padStart(4,'0')
- `isStageOverdue(stageUpdatedAt:Date|string, limitDays:number):boolean`

- [ ] **Step 1:** Tests fallando primero (ejemplo):
```ts
// src/tests/unit/format.test.ts
import { formatCurrency, buildReference } from "@/lib/format";
test("formatCurrency EUR", () => expect(formatCurrency(250000)).toContain("250.000"));
test("reference padded", () => expect(buildReference(7)).toBe("REF-0007"));
```
- [ ] **Step 2:** `npx vitest run` -> FAIL (modulos no existen).
- [ ] **Step 3:** Implementar modulos minimos.
- [ ] **Step 4:** `npx vitest run` -> PASS. Commit: `feat: tipos, constantes y utils con tests`.

## FASE 1 — Auth y Tenancy

### Task 5: Login con branding de agencia

**Files:** Create: `src/app/login/page.tsx`, `src/components/auth/LoginForm.tsx`. Modify: `0001_schema.sql` (funcion publica de branding).

**Interfaces:** `get_public_branding(p_slug text)` -> `(name, logo_url, primary_color)` SECURITY DEFINER para rol `anon` (solo agencias activas). La consume la pagina de login pre-auth.

- [ ] **Step 1:** Anadir funcion SQL + grants:
```sql
create or replace function public.get_public_branding(p_slug text)
returns table (name text, logo_url text, primary_color text)
language sql stable security definer set search_path = public as $$
  select a.name, a.logo_url, a.primary_color
  from public.agencies a where a.slug = p_slug and a.active;
$$;
grant execute on function public.get_public_branding(text) to anon, authenticated;
```
- [ ] **Step 2:** Pagina `/login`: lee `searchParams.agencia`; si falta, input de slug de agencia primero; guarda slug en `localStorage('agency_slug')` y lo precarga en visitas siguientes. Aplica `--brand` CSS var + logo.
- [ ] **Step 3:** `LoginForm`: email+password con `signInWithPassword`; enlace "entrar por enlace magico" `signInWithOtp({email})`; tras exito `router.replace(next ?? '/dashboard')`. Errores en espanol ("Credenciales incorrectas"). Si agencia inactiva -> bloqueo con mensaje claro.
- [ ] **Step 4:** Verificar manual: login con usuario demo (creado en Task 6), branding cambia con `?agencia=`. Build OK. Commit: `feat: login con branding dinamico`.

### Task 6: Invitacion de usuarios (alta de agentes/admins)

**Files:** Create: `src/lib/admin-users.ts`, `src/lib/validators/user.ts`, `src/tests/unit/invite-schema.test.ts`.

**Interfaces:** `inviteUser({email, role, fullName}): Promise<void>` (server-only, usa `SUPABASE_SERVICE_ROLE_KEY`): `auth.admin.createUser({email, email_confirm:true, user_metadata:{agency_id, role, full_name}})` + `generateLink` invite. El trigger `handle_new_user` (Task 3) crea el profile.

- [ ] **Step 1:** Test del esquema zod fallando: rol invalido rechazado, email invalido rechazado.
```ts
test("rechaza rol invalido", () =>
  expect(inviteSchema.safeParse({email:"a@b.c",role:"dios",fullName:"X"}).success).toBe(false));
```
- [ ] **Step 2:** Implementar `inviteUser` (nunca expuesta al cliente; llamada solo desde server action de Ajustes en Task 16/Ajustes).
- [ ] **Step 3:** vitest PASS. Commit: `feat: invitacion de usuarios con metadata de perfil`.

## FASE 2 — Shell de aplicacion

### Task 7: Layout, sidebar, topbar y navegacion movil

**Files:** Create: `src/app/(app)/layout.tsx`, `src/components/layout/{Sidebar,Topbar,BottomBar,Fab,UserMenu,AvisosBell,UniversalSearch,CreateMenu}.tsx`, `src/components/theme/BrandProvider.tsx`. Pages placeholder: dashboard/propiedades/contactos/pipeline/agenda/ajustes con `EmptyState "Modulo en construccion"`.

**Interfaces:** `(app)/layout.tsx` carga servidor: `{profile, agency}` via `createServerClient`; si `profile.agency_id` null y no super_admin -> redirect login. `BrandProvider` setea `--brand` y `--brand-fg` (contraste calculado) desde `agency.primary_color`.

- [ ] **Step 1:** Sidebar desktop: logo+nombre agencia, nav (Dashboard, Propiedades, Contactos, Pipeline, Agenda, Ajustes; +Maestro si `role='super_admin'`), colapsable a iconos (estado en `localStorage`). Mobile (<md): oculto.
- [ ] **Step 2:** Topbar sticky: `UniversalSearch` (Command con busqueda debounced 300ms sobre `properties(title,reference,city,ilike)` y `contacts(full_name,phone,email)` limit 5 c/u; navega al resultado), `CreateMenu` "+ Crear" (Propiedad/Contacto/Tarea -> rutas nuevas), `AvisosBell` (count: tareas hoy+vencidas, leads `status='nuevo'` sin actividades >24h; dropdown lista), `UserMenu` (nombre, avatar, Salir -> `signOut`).
- [ ] **Step 3:** Mobile: `BottomBar` fija (Inicio, Propiedades, Contactos, Pipeline) + `Fab` esquina inferior derecha abriendo `CreateMenu`.
- [ ] **Step 4:** Verificar responsive en devtools 375px y 1440px; build OK. Commit: `feat: shell app con sidebar, topbar y nav movil`.

### Task 8: Componentes compartidos

**Files:** Create: `src/components/shared/{DataTable,StatusBadge,EmptyState,Skeletons,ConfirmDialog}.tsx`.

**Interfaces:** `DataTable<T>({columns,data,isLoading,emptyState})` wrapper TanStack Table con paginacion; `StatusBadge({meta})` usando maps de constants; `EmptyState({icon,title,description,cta})`; `CardSkeleton/TableSkeleton/KanbanSkeleton`; `ConfirmDialog` para destructivas.

- [ ] **Step 1:** Implementar los 5 componentes (patrones estandar shadcn/TanStack).
- [ ] **Step 2:** Verificar en pagina propiedades placeholder; build. Commit: `feat: componentes compartidos de tabla y estados`.

## FASE 3 — Propiedades

### Task 9: Lista de propiedades con filtros

**Files:** Create: `src/lib/queries/properties.ts`, `src/app/(app)/propiedades/page.tsx`, `src/components/properties/{PropertyCard,PropertyFilters}.tsx`.

**Interfaces:** `listProperties(filters: PropertyFilters): Promise<PropertyWithImages[]>` — `.select('*, property_images(url,position)')`, filtros: `q` (ilike title/reference/city), status, operation, property_type, priceMin/priceMax, page (12/page). RLS aisla agencia automaticamente.

- [ ] **Step 1:** Server Component lee `searchParams` -> `listProperties` -> grid responsive (1/2/3 cols) de `PropertyCard`: imagen principal 16:9 (placeholder si vacia), precio, referencia, badges tipo/operacion, `StatusBadge`, specs (hab/banos/m2 con lucide icons).
- [ ] **Step 2:** `PropertyFilters` (client) sincroniza con URL via `router.push(searchParams)`; chips de filtros activos removibles.
- [ ] **Step 3:** Skeleton grid durante loading (`useTransition`) y `EmptyState` con CTA "+ Nueva propiedad".
- [ ] **Step 4:** Manual: crear 3 propiedades via SQL temporal para ver la vista. Build. Commit: `feat: lista propiedades con filtros persistentes`.

### Task 10: Ficha de propiedad: CRUD, galeria y estados

**Files:** Create: `src/app/(app)/propiedades/nuevo/page.tsx`, `src/app/(app)/propiedades/[id]/page.tsx`, `src/app/actions/properties.ts`, `src/lib/validators/property.ts`, `src/components/properties/{PropertyForm,GalleryManager,PropertyTabs,StatusActions}.tsx`.

**Interfaces (server actions):**
- `createProperty(input): Promise<{id}>` — genera `reference` con `select max(reference)` -> `buildReference`
- `updateProperty(id, input)`, `setPropertyStatus(id, status)`
- `uploadImage(propertyId, file)`, `deleteImage(imageId)`, `reorderImages(propertyId, ids[])`

Zod: title>=5, operation/property_type enum, price>0, bedrooms/bathrooms >=0 int opcional, lat/lng number opcional, city requerido.

- [ ] **Step 1:** `PropertyForm` (react-hook-form + zodResolver): secciones Datos basicos / Direccion / Caracteristicas (checkboxes fijos: piscina, garaje, terraza, ascensor, aire, jardin, trastero).
- [ ] **Step 2:** `[id]/page.tsx` con `PropertyTabs`: Tab Datos (form), Tab Galeria (`GalleryManager`: subida multiple -> Storage `property-images/{agency_id}/{propertyId}/`, grid miniaturas drag-reorder @dnd-kit/sortable persistiendo `position`, borrar con ConfirmDialog), Tab Visitas (timeline `activities` por property_id, se llena en Task 12).
- [ ] **Step 3:** `StatusActions` dropdown (Activar/Reservar/Vender/Retirar); al Vender pregunta si marcar sus deals como ganados.
- [ ] **Step 4:** Manual end-to-end: crear, subir 2 fotos, reordenar, activar, ver en lista. Commit: `feat: crud propiedad con galeria drag-drop y ciclo de estado`.

### Task 11: Vista mapa de propiedades

**Files:** Create: `src/components/properties/PropertiesMap.tsx`. Modify: `propiedades/page.tsx` (toggle Lista|Mapa).

- [ ] **Step 1:** `PropertiesMap` con `dynamic(() => import(...), {ssr:false})`: MapContainer + tiles OSM, markers de propiedades con coords; Popup: foto, precio, ref, link a ficha; fitBounds a resultados. Contador "N sin ubicacion" con boton que abre la ficha para geolocalizar (inputs lat/lng manuales en form ya existen).
- [ ] **Step 2:** Verificar toggle y popups; build. Commit: `feat: vista mapa propiedades con leaflet/osm`.

## FASE 4 — Contactos

### Task 12: Lista de contactos y ficha 360 con timeline

**Files:** Create: `src/lib/queries/{contacts,activities}.ts`, `src/app/(app)/contactos/page.tsx`, `src/app/actions/contacts.ts`, `src/components/contacts/{ContactsTable,ContactDrawer,ActivityFeed,QuickActions,DealCreateDialog}.tsx`, `src/components/shared/ActivityComposer.tsx`. Modify: Tab Visitas de propiedad para reusar `ActivityFeed` por property.

**Interfaces:**
- `listContacts(filters)` (q sobre full_name/phone/email; status; source; assigned_to)
- `createContact(input)`, `updateContact(id,input)`
- `addActivity({type,title,body?,contactId?,propertyId?,dealId?,dueDate?})` -> ademas crea activity `sistema` automatica en cambios de deal/propiedad
- `createOffer({contactId, propertyId, value})` -> inserta deal stage nuevo_lead + activity sistema "Oferta creada"

- [ ] **Step 1:** `ContactsTable` (DataTable): columnas nombre+tipo, telefono/email, estado badge, origen, presupuesto, agente avatar, ultima actividad relativa.
- [ ] **Step 2:** `ContactDrawer` (Sheet right, no pierde filtros al cerrar): columna izq perfil editable inline (nombre/tipo/tel/email/presupuesto/zonas preferidas/notas) + consent RGPD indicador; centro `ActivityFeed` timeline inversa agrupada por dia con icono por tipo; derecha `QuickActions`: Llamada / Email / Nota (abren `ActivityComposer` modal), WhatsApp (`wa.me/{phone}` nueva pestana), Tarea (due_date), Oferta (`DealCreateDialog`: select propiedad + importe).
- [ ] **Step 3:** Estados de carga skeleton + empty state. Manual: crear contacto, registrar llamada, crear oferta; verificar deals y activities. Commit: `feat: contactos con ficha 360 y timeline unificada`.

## FASE 5 — Pipeline Kanban

### Task 13: Tablero Kanban con drag-and-drop y alertas SLA

**Files:** Create: `src/app/(app)/pipeline/page.tsx`, `src/app/actions/deals.ts`, `src/components/pipeline/{KanbanBoard,KanbanCard,DealDrawer}.tsx`.

**Interfaces:**
- `listDeals()` -> join contacts(nombre)+properties(imagen1,precio,titulo)+profiles(avatar)
- `moveDeal(id, stage)` -> set stage + stage_updated_at=now()
- `closeDeal(id, won:boolean, lostReason?)` -> won bool; si won y property_id: sugerir property vendida
- `isStageOverdue(stageUpdatedAt, settings.pipeline_stage_days[stage])`

- [ ] **Step 1:** `KanbanBoard`: 5 columnas scroll horizontal; header con nombre etapa + count + suma valores compacta (ej. 1.2M EUR); cards con @dnd-kit/sortable cross-column, update optimista + rollback en error toast.
- [ ] **Step 2:** Card: miniatura inmueble 16:9, contacto, presupuesto, avatar agente, dias en etapa, borde rojo si overdue (settings de agencia).
- [ ] **Step 3:** `DealDrawer` al click: notas editables, valor, historial activities del deal, botones Ganado/Perdido (Perdido pide motivo; ConfirmDialog).
- [ ] **Step 4:** Mobile fallback: selector de etapa en header de card (sin drag). Manual: mover deal por todas las etapas; ganar uno y verificar propiedad. Commit: `feat: pipeline kanban dnd con sla y cierre ganado-perdido`.

## FASE 6 — Agenda

### Task 14: Agenda dia/mes y tareas

**Files:** Create: `src/app/(app)/agenda/page.tsx`, `src/app/actions/tasks.ts`, `src/components/agenda/{DayList,MonthGrid,TaskDialog}.tsx`.

**Interfaces:** `listTasks(range:{from,to})` orden due_date asc; `completeTask(id)` completed_at now; `rescheduleTask(id,newDate)`.

- [ ] **Step 1:** Toggle Dia|Mes: Dia = lista cronologica (pendientes arriba, completadas tachadas); Mes = Calendar shadcn con dots por tarea, click dia filtra lista.
- [ ] **Step 2:** `TaskDialog` crear/editar: titulo, fecha-hora, contacto opcional (combobox busca), propiedad opcional, notas. Reprogramar rapido desde fila (+1 dia / elegir fecha).
- [ ] **Step 3:** Manual + build. Commit: `feat: agenda dia-mes con tareas reprogramables`.

## FASE 7 — Dashboard

### Task 15: KPIs, embudo y alertas del dia

**Files:** Create: `src/app/(app)/dashboard/page.tsx`, `src/lib/queries/stats.ts`, `src/components/dashboard/{KpiCards,PipelineFunnel,TodayPanel}.tsx`.

**Interfaces:** `getDashboardStats(scope)` scope agent|admin:
- leadsNuevos7d vs 7d previos (delta %), propiedadesActivas count, visitasMes count (activities type visita), valorPipeline suma deals abiertos
- funnel counts por DEAL_STAGES
- tareasHoy + tareasVencidas list
- leadsSLA: contacts status nuevo sin activity > settings.sla_lead_hours

- [ ] **Step 1:** KpiCards 4 tarjetas con delta flecha verde/roja y tooltip explicativo; PipelineFunnel BarChart horizontal recharts; TodayPanel dos listas (Tareas hoy / Alertas SLA) con links directos a ficha.
- [ ] **Step 2:** Skeletons en cada widget; role-aware (agent ve solo lo asignado). Build + manual con datos demo. Commit: `feat: dashboard kpis embudo y alertas`.

## FASE 8 — Ajustes de agencia

### Task 16: Ajustes: usuarios, branding propio y datos de la agencia

**Files:** Create: `src/app/(app)/ajustes/page.tsx`, `src/app/actions/my-agency.ts`, `src/components/settings/{UsersManager,BrandingForm}.tsx`.

**Interfaces:**
- `updateMyAgencyBrand({name?, logoUrl?, primaryColor?})` — solo admin; valida color hex
- Reusa `inviteUser` (Task 6) desde `UsersManager`: lista perfiles de la agencia, invita por email con rol (admin/agent), desactiva acceso (ban via service_role)

- [ ] **Step 1:** Tab Usuarios: tabla perfiles (nombre, email, rol, avatar) + dialog invitacion (email, nombre, rol). Solo admin ve esta tab.
- [ ] **Step 2:** Tab Branding: form nombre/logo (upload bucket `branding/{agency_id}/`)/color con preview en vivo del shell.
- [ ] **Step 3:** Guard rol admin para ambas acciones; agents ven pagina informativa sin edicion. Build + manual. Commit: `feat: ajustes de agencia con gestion usuarios y branding`.

## FASE 9 — Panel maestro (super_admin)

### Task 17: Gestion de agencias e impersonacion

**Files:** Create: `src/app/(app)/maestro/page.tsx`, `src/app/actions/agencies.ts`, `src/components/maestro/{AgenciesTable,AgencyDialog,ImpersonateButton}.tsx`, banner en shell.

**Interfaces:**
- `upsertAgency(input)` name/slug auto/color/logo(settings)/settings{sla_lead_hours, pipeline_stage_days, web_form}
- `toggleAgencyActive(id, active)`
- `impersonateStart(agencyId)` -> update profiles.active_agency_id + insert impersonation_logs; `impersonateStop()` -> null + ended_at
- Conteos por agencia (usuarios, propiedades, contactos, deals)

- [ ] **Step 1:** Tabla agencias con conteos y acciones; `AgencyDialog` con preset colores + preview branding + campos SLA/dias por etapa.
- [ ] **Step 2:** Desactivada => login bloqueado (login valida active). `ImpersonateButton`: entra como admin de esa agencia; Banner fijo amarillo "Estas viendo {agencia} - Salir" visible mientras active_agency_id != null; Salir limpia y cierra log.
- [ ] **Step 3:** Guard: paginas maestro solo super_admin (redirect dashboard). Verificar RLS cruzada: usuario demo A no ve datos de B. Commit: `feat: panel maestro con branding, activacion e impersonacion auditada`.

## FASE 10 — Captacion web publica

### Task 18: Formulario embebible + endpoint publico

**Files:** Create: `src/app/form/[slug]/page.tsx`, `src/app/api/public/leads/[slug]/route.ts`, `src/lib/rate-limit.ts`, `src/lib/email.ts`. Modify: ajustes tab Captacion web (snippet iframe copiable).

**Interfaces:**
- `POST /api/public/leads/[slug]` body `{fullName, phone, email?, message?, companyUrl?}` (companyUrl=honeypot)
- Rate limit memoria 5 req/min/IP (429 si excede)
- Contact upsert por telefono dentro de la agencia: existe -> add activity sistema con mensaje; nuevo -> source web, consent true/at now
- Email via Resend a profiles admin de la agencia (best-effort, nunca rompe el POST)

Zod server-side estricto; sin auth; CORS abierto solo para este path (iframe lo requiere).

- [ ] **Step 1:** Pagina `/form/[slug]`: branding publico (get_public_branding), campos segun settings.web_form {showEmail, showMessage}, mensaje gracias configurable, diseno limpio mobile-first.
- [ ] **Step 2:** Endpoint completo con validacion/honeypot (si honeypot viene relleno -> 200 fake success silencioso)/rate limit/upsert/email.
- [ ] **Step 3:** Ajustes: toggle activo + snippet `<iframe src="{APP_URL}/form/{slug}" style="width:100%;height:640px;border:0;border-radius:12px"></iframe>` con boton copiar.
- [ ] **Step 4:** Prueba curl 201, duplicado crea actividad, 6ª llamada 429. Commit: `feat: captacion web publica con rgpd y antispam`.

## FASE 11 — Cierre

### Task 19: E2E smoke Playwright + pulido

**Files:** Create: `playwright.config.ts`, `src/e2e/smoke.spec.ts`.

- [ ] **Step 1:** Spec flujo feliz completo: login demo admin -> crear propiedad con foto -> crear contacto -> registrar llamada -> crear oferta -> mover deal a cierre ganado -> confirmar propiedad vendida -> dashboard muestra KPIs > 0.
- [ ] **Step 2:** Ejecutar, arreglar bugs encontrados hasta PASS x2 consecutivas. Commit: `test: e2e smoke del flujo comercial completo`.
- [ ] **Step 3:** Pulido visual: revisar 375/768/1440px, estados vacios, toasts; `npm run build` limpio.

### Task 20: Despliegue y conexion con webs cliente

- [ ] **Step 1:** Vercel: import repo, env vars de produccion (Supabase prod + Resend + APP_URL). Migraciones ejecutadas en proyecto Supabase prod.
- [ ] **Step 2:** Verificacion multi-agencia en prod: 2 agencias, login cruzado, cero fugas de datos (RLS).
- [ ] **Step 3:** README: como dar de alta una inmobiliaria (panel maestro), snippet del boton Admin para su web:
```html
<a href="https://TU-CRM.vercel.app/login?agencia={slug}">Admin</a>
```
- [ ] **Step 4:** Commit final: `chore: release mvp crm inmobiliario`.

## Verificacion final del MVP

```bash
npm run build && npx vitest run && npx playwright test
```
Criterios del spec (seccion 10): aislamiento entre agencias verificado, flujo lead->cierre end-to-end OK, branding cambia sin codigo, usable en movil.



