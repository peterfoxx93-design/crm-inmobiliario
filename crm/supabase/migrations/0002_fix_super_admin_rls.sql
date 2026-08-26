-- 0002_fix_super_admin_rls.sql
-- Fix: super_admin bypass must not apply when impersonating (active_agency_id not null).
-- Antes: `agency_id = get_my_agency_id() OR is_super_admin()` dejaba ver todo incluso suplantando.
-- Ahora: super_admin solo ve todo si NO está suplantando (get_my_agency_id() IS NULL).
-- Se re-crean las policies de negocio; el helper get_my_agency_id ya existe (coalesce active,agency).

-- properties
drop policy if exists "agency_isolation" on public.properties;
create policy "agency_isolation" on public.properties for all
  using (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null))
  with check (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null));

-- contacts
drop policy if exists "agency_isolation" on public.contacts;
create policy "agency_isolation" on public.contacts for all
  using (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null))
  with check (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null));

-- deals
drop policy if exists "agency_isolation" on public.deals;
create policy "agency_isolation" on public.deals for all
  using (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null))
  with check (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null));

-- activities
drop policy if exists "agency_isolation" on public.activities;
create policy "agency_isolation" on public.activities for all
  using (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null))
  with check (agency_id = public.get_my_agency_id() or (public.is_super_admin() and public.get_my_agency_id() is null));

-- property_images (sin agency_id, vía properties)
drop policy if exists "agency_isolation" on public.property_images;
create policy "agency_isolation" on public.property_images for all
  using (
    (public.is_super_admin() and public.get_my_agency_id() is null)
    or exists (select 1 from public.properties p where p.id = property_id and p.agency_id = public.get_my_agency_id())
  )
  with check (
    (public.is_super_admin() and public.get_my_agency_id() is null)
    or exists (select 1 from public.properties p where p.id = property_id and p.agency_id = public.get_my_agency_id())
  );
