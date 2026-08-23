-- ============================================================================
-- CRM Inmobiliario - Esquema multi-tenant con RLS
-- Archivo: crm/supabase/migrations/0001_schema.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
--              (paso A de crm/supabase/VERIFY.md)
--
-- Preliminar: extension pgcrypto.
-- Orden deliberado de este archivo (importante):
--   1. tablas
--   2. helpers RLS (get_my_agency_id / is_super_admin / is_agency_admin)
--      DESPUES de las tablas: son "language sql" y con check_function_bodies=on
--      (por defecto) CREATE FUNCTION valida el cuerpo al crearlas; leen
--      public.profiles, asi que NO pueden crearse antes que esa tabla.
--   3. funciones de trigger + triggers (usan los helpers en tiempo de ejecucion)
--   4. RLS + policies (usan los helpers del punto 2)
--   5. grants explicitos para anon / authenticated
--   6. indices
--   7. storage: buckets publicos + policies por carpeta de agencia
--
-- Convencion multi-tenant: toda tabla de negocio lleva agency_id y solo se ve
-- la propia agencia (o todo, si eres super_admin). El storage usa como primera
-- carpeta del path el UUID de la agencia: {agency_id}/...
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

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
  address text,
  city text not null, -- ciudad obligatoria (enmienda controller; formularios spec)
  zone text,
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

-- ---------------------------------------------------------------------------
-- 2. Helpers RLS
--    security definer para evitar recursion en las policies de profiles
--    (se crean tras public.profiles; ver nota de orden en la cabecera).
-- ---------------------------------------------------------------------------

create or replace function public.get_my_agency_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(p.active_agency_id, p.agency_id)
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_agency_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- 3. Funciones de trigger + triggers
-- ---------------------------------------------------------------------------

-- Trigger updated_at generico (aplicar a: agencies, profiles, properties,
-- contacts, deals; activities no lleva updated_at)
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger agencies_set_updated_at before update on public.agencies
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

create trigger deals_set_updated_at before update on public.deals
for each row execute function public.set_updated_at();

-- Trigger: nuevo usuario auth -> profile con metadata de invitacion
-- (security definer: inserta en profiles sin pasar por RLS)
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

-- Guarda anti-escalada de privilegios en profiles:
-- - evita que un agent/admin se auto-promueva o mueva su perfil a otra agencia
--   (las policies permisivas en OR podrian permitirlo).
-- - cambios de rol desde sesion de usuario: solo un super_admin, o un admin
--   alternando entre 'admin' y 'agent' (nunca hacia/desde 'super_admin').
-- - NO afecta al bootstrap desde SQL Editor ni a server actions con
--   service_role: ahi no hay JWT de usuario (auth.uid() es null) y se omite.
create or replace function public.guard_profile_privilege_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Contextos de servidor/administracion (SQL Editor, service_role): sin JWT
  if auth.uid() is null or public.is_super_admin() then
    return new;
  end if;
  if new.id <> old.id then
    raise exception 'no se puede cambiar el id de un perfil';
  end if;
  if new.role is distinct from old.role then
    if not (
      public.is_agency_admin()
      and old.role in ('admin','agent')
      and new.role in ('admin','agent')
    ) then
      raise exception 'solo un super_admin puede asignar el rol super_admin o cambiar roles fuera de admin<->agent';
    end if;
  end if;
  if new.agency_id is distinct from old.agency_id then
    raise exception 'solo un super_admin puede cambiar la agencia de un perfil';
  end if;
  if new.active_agency_id is distinct from old.active_agency_id then
    raise exception 'solo un super_admin puede usar la impersonacion';
  end if;
  return new;
end $$;
create trigger profiles_guard_escalation before update on public.profiles
for each row execute function public.guard_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 4. RLS + policies
-- ---------------------------------------------------------------------------

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.impersonation_logs enable row level security;

-- --- agencies: lectura propia (o super_admin); escritura solo super_admin ---
create policy "agency_select_own" on public.agencies for select
to authenticated
using (
  id = public.get_my_agency_id()
  or public.is_super_admin()
);

create policy "agency_write_super_admin" on public.agencies for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- --- profiles: ver/editar perfiles de tu agencia o el propio ---------------
create policy "profiles_select_own_or_agency" on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or agency_id = public.get_my_agency_id()
  or public.is_super_admin()
);

create policy "profiles_update_self" on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Un admin gestiona miembros de SU agencia (roles admin/agent, nunca tocar un
-- super_admin); el guard trigger ademas impide escalar a super_admin y mover
-- filas fuera de la agencia. Requiere que quien ACTUA sea admin/super: sin
-- esta comprobacion, cualquier agent podria editar perfiles ajenos.
create policy "profiles_update_by_admin" on public.profiles for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_agency_admin()
    and role in ('admin', 'agent')
    and agency_id = public.get_my_agency_id()
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_agency_admin()
    and role in ('admin', 'agent')
    and agency_id = public.get_my_agency_id()
  )
);

-- Sin policy de insert/delete en profiles: clientes jamas crean/borran perfiles
-- (el alta la hace handle_new_user como definer; bajas por cascada de auth.users).

-- --- tablas de negocio con agency_id propio ---------------------------------
create policy "agency_isolation" on public.properties for all
using (agency_id = public.get_my_agency_id() or public.is_super_admin())
with check (agency_id = public.get_my_agency_id() or public.is_super_admin());

create policy "agency_isolation" on public.contacts for all
using (agency_id = public.get_my_agency_id() or public.is_super_admin())
with check (agency_id = public.get_my_agency_id() or public.is_super_admin());

create policy "agency_isolation" on public.deals for all
using (agency_id = public.get_my_agency_id() or public.is_super_admin())
with check (agency_id = public.get_my_agency_id() or public.is_super_admin());

create policy "agency_isolation" on public.activities for all
using (agency_id = public.get_my_agency_id() or public.is_super_admin())
with check (agency_id = public.get_my_agency_id() or public.is_super_admin());

-- property_images no tiene agency_id: se resuelve via properties (la subquery
-- pasa tambien por la RLS de properties, misma frontera tenant)
create policy "agency_isolation" on public.property_images for all
using (
  public.is_super_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and p.agency_id = public.get_my_agency_id()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1 from public.properties p
    where p.id = property_id
      and p.agency_id = public.get_my_agency_id()
  )
);

-- --- impersonation_logs: solo super_admin; inmutables (sin update/delete) ---
create policy "impersonation_logs_select_super_admin" on public.impersonation_logs for select
to authenticated
using (public.is_super_admin());

create policy "impersonation_logs_insert_super_admin" on public.impersonation_logs for insert
to authenticated
with check (super_admin_id = auth.uid() and public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. Grants explicitos
--    En Supabase los roles anon/authenticated ya tienen USAGE sobre public y
--    DML por default privileges; se dejan explicitos para no depender de eso.
--    La frontera REAL de datos es RLS: para anon todas las policies evaluan a
--    falso (get_my_agency_id() = null), luego ve 0 filas siempre.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Indices
-- ---------------------------------------------------------------------------

create index idx_properties_agency_status on public.properties (agency_id, status);
create index idx_contacts_agency_status on public.contacts (agency_id, status);
create index idx_deals_agency_stage on public.deals (agency_id, stage);
create index idx_activities_contact on public.activities (contact_id, created_at desc);
create index idx_activities_due on public.activities (agency_id, due_date) where type = 'tarea';

-- ---------------------------------------------------------------------------
-- 7. Storage: buckets publicos + policies por carpeta de agencia
--    Fuente: https://supabase.com/docs/guides/storage/security/access-control
--            https://supabase.com/docs/guides/storage/buckets/creating-buckets
--    Convencion de rutas: {agency_uuid}/... (primera carpeta del path).
--    Si este bloque fallara por permisos sobre storage.buckets, crea los dos
--    buckets desde Dashboard > Storage (publicos) y pega solo las policies.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('property-images', 'property-images', true),
  ('branding', 'branding', true)
on conflict (id) do nothing;

-- Lectura publica (anon + authenticated) en los dos buckets
create policy "storage_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id in ('property-images', 'branding'));

-- Escritura en property-images: authenticated SOLO dentro de su carpeta de
-- agencia ({agency_uuid}/...); super_admin sin limite
create policy "storage_property_images_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);

create policy "storage_property_images_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-images'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
)
with check (
  bucket_id = 'property-images'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);

create policy "storage_property_images_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-images'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);

-- Escritura en branding: mismas reglas
create policy "storage_branding_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'branding'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);

create policy "storage_branding_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'branding'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
)
with check (
  bucket_id = 'branding'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);

create policy "storage_branding_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'branding'
  and (
    public.is_super_admin()
    or (((storage.foldername(name))[1])::uuid = public.get_my_agency_id())
  )
);
