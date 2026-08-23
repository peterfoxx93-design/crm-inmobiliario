-- ============================================================================
-- CRM Inmobiliario - Seed inicial
-- Archivo: crm/supabase/seed.sql
-- Ejecutar en SQL Editor DESPUES de 0001_schema.sql (paso B de crm/supabase/VERIFY.md)
--
-- El super_admin NO se crea aqui: se hace desde Authentication > Users + un
-- insert/update en profiles (ver paso C de crm/supabase/VERIFY.md).
-- ============================================================================

-- Agencia demo
insert into public.agencies (name, slug, primary_color, settings)
values (
  'Agencia Demo',
  'demo',
  '#2563eb',
  '{"sla_lead_hours":24,"pipeline_stage_days":{"nuevo_lead":7,"calificado":7,"visita":10,"negociacion":14}}'::jsonb
)
on conflict (slug) do nothing;
