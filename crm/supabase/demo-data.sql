-- ============================================================================
-- CRM Inmobiliario - Datos demo para la agencia 'demo'  (IDEMPOTENTE)
-- Archivo: crm/supabase/demo-data.sql
--
-- Violenable: puedes ejecutarlo tantas veces como quieras; cada vez limpia
-- los datos demo anteriores de la agencia 'demo' y los vuelve a crear.
--
-- PREPARACION (1 paso previo):
--   Authentication > Users > Add user:
--     email: admin@demo.es   password: Demo1234!   [X] Auto Confirm User
--
-- PARA VERLO: entra con admin@demo.es en "/login?agencia=demo",
--   o impersona la agencia 'demo' desde /maestro con tu super_admin.
-- ============================================================================

do $$
declare
  dag uuid;
  usr uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
begin
  select id into dag from public.agencies where slug = 'demo';

  -- Vincular admin@demo.es a la agencia 'demo' como admin
  update public.profiles p
  set agency_id = dag,
      active_agency_id = null,
      role = 'admin',
      full_name = 'Nuria Peinado'
  from auth.users u
  where u.id = p.id
    and u.email = 'admin@demo.es';

  select p.id into usr
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'admin@demo.es'
  limit 1;

  if dag is null or usr is null then
    raise exception 'Falta la agencia demo o el usuario admin@demo.es (crea primero el usuario en Authentication > Users)';
  end if;

  -- ============ LIMPIEZA PREVIA (orden respetando FKs) ============
  delete from public.activities where agency_id = dag;
  delete from public.deals      where agency_id = dag;
  delete from public.properties where agency_id = dag;  -- borra en cascada property_images
  delete from public.contacts   where agency_id = dag;

  -- ========================= PROPIEDADES =========================
  insert into public.properties
    (agency_id, reference, title, description, property_type, operation, status,
     price, bedrooms, bathrooms, surface_m2, address, city, zone, lat, lng, features,
     created_by, created_at) values
    (dag, 'PRO-0001', 'Piso reformado en Chamberi', 'Exterior luminoso, plaza de garaje incluida y trastero.',
     'piso', 'venta', 'activo', 425000, 3, 2, 96, 'Calle Zurbano 14', 'Madrid', 'Chamberi',
     40.4326, -3.6972, '{terraza,ascensor,garaje}'::text[], usr, now() - interval '40 days'),
    (dag, 'PRO-0002', 'Villa con piscina en La Moraleja', 'Villa de lujo reformada con jardin y piscina propia.',
     'casa', 'venta', 'reservado', 1200000, 6, 5, 480, 'Avenida de la Moraleja 88', 'Alcobendas', 'La Moraleja',
     40.5205, -3.6688, '{piscina,jardin,garaje,calefaccion}'::text[], usr, now() - interval '35 days'),
    (dag, 'PRO-0003', 'Estudio centrico en Malasana', 'Luz brillante, zona tranquila junto al metro.',
     'piso', 'alquiler', 'activo', 950, 1, 1, 34, 'Calle de la Espada 7', 'Madrid', 'Malasana',
     40.4258, -3.7042, '{}'::text[], usr, now() - interval '28 days'),
    (dag, 'PRO-0004', 'Chalet adosado en Costa del Sol', 'Tres plantas con piscina comunitaria y aparcamiento.',
     'villa', 'venta', 'borrador', 620000, 5, 3, 180, 'Urbanizacion Marina del Sur', 'Marbella', 'Costa del Sol',
     36.5101, -4.8820, '{piscina,jardin,garaje}'::text[], usr, now() - interval '10 days'),
    (dag, 'PRO-0005', 'Oficina en Castellana 120', 'Planta entera con vistas a la Castellana.',
     'oficina', 'alquiler', 'retirado', 1800, 0, 1, 210, 'Paseo de la Castellana 120', 'Madrid', 'Castellana',
     40.4472, -3.6910, '{aire-acondicionado,ascensor}'::text[], usr, now() - interval '60 days');

  select id into p1 from public.properties where reference = 'PRO-0001';
  select id into p2 from public.properties where reference = 'PRO-0002';
  select id into p3 from public.properties where reference = 'PRO-0003';
  select id into p4 from public.properties where reference = 'PRO-0004';
  select id into p5 from public.properties where reference = 'PRO-0005';

  -- ============ IMAGENES (inmobiliarias reales, Unsplash) ============
  insert into public.property_images (property_id, url, position) values
    (p1, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80', 0),
    (p1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80', 1),
    (p2, 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', 0),
    (p2, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80', 1),
    (p2, 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80', 2),
    (p3, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', 0),
    (p4, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', 0),
    (p4, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', 1),
    (p4, 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', 2);

  -- ============ CONTACTOS ============
  insert into public.contacts
    (agency_id, contact_type, full_name, email, phone, notes, source, source_detail,
     status, budget_max, preferences, consent_rgpd, consent_at, assigned_to, created_by, created_at) values
    (dag, 'propietario', 'Jose Luis Marin', 'jmar@gmail.com', '+34600111222', null, 'referido', null,
     'calificado', null, '{}'::jsonb, true, now() - interval '40 days', usr, usr, now() - interval '40 days'),
    (dag, 'propietario', 'Carla Herrera', 'carla@gmail.com', '+34600222333', null, 'portal', 'Idealista',
     'en_seguimiento', null, '{}'::jsonb, true, now() - interval '30 days', usr, usr, now() - interval '30 days'),
    (dag, 'comprador', 'Antonio Vega', 'avega@mail.com', '+34600333444', 'Busca piso nuevo.',
     'web', 'Formulario web',
     'calificado', 285000, '{"zona":"Chamberi","min_habitaciones":3,"max_habitaciones":4}'::jsonb,
     true, now() - interval '9 days', usr, usr, now() - interval '9 days'),
    (dag, 'comprador', 'Lucia Fernandez', 'lucia.f@mail.com', '+34600444555', null, 'portal', 'Fotocasa',
     'nuevo', 1200000, '{}'::jsonb, true, now() - interval '3 days', usr, usr, now() - interval '3 days'),
    (dag, 'inquilino', 'Ruben Solis', 'ruben.s@mail.com', '+34600555666', 'Presupuesto maximo 1000 euros/mes.', 'web',
     'Formulario web', 'en_seguimiento', 1000, '{}'::jsonb, true, now() - interval '2 days', usr, usr, now() - interval '2 days'),
    (dag, 'comprador', 'Elena Manso', 'elena.m@mail.com', '+34600666777', null, 'referido', null,
     'nuevo', null, '{}'::jsonb, false, null, usr, usr, now() - interval '1 day');

  select id into c1 from public.contacts where full_name = 'Jose Luis Marin';
  select id into c2 from public.contacts where full_name = 'Carla Herrera';
  select id into c3 from public.contacts where full_name = 'Antonio Vega';
  select id into c4 from public.contacts where full_name = 'Lucia Fernandez';
  select id into c5 from public.contacts where full_name = 'Ruben Solis';
  select id into c6 from public.contacts where full_name = 'Elena Manso';

  -- ============ DEALS ============
  insert into public.deals
    (agency_id, contact_id, property_id, agent_id, stage, value, notes, won, lost_reason, stage_updated_at, created_at) values
    (dag, c3, p1, usr, 'negociacion', 250000, 'Visita realizada. Oferta en mesa.', null, null,
     now() - interval '2 days', now() - interval '20 days'),
    (dag, c4, p2, usr, 'visita', 1200000, 'Vista reservada; quiere una segunda visita.', null, null,
     now() - interval '4 days', now() - interval '15 days'),
    (dag, c5, p3, usr, 'calificado', null, 'Busca piso en alquiler cerca del centro.', null, null,
     now() - interval '1 day', now() - interval '6 days'),
    (dag, c2, p4, usr, 'negociacion', 670000, 'Negociando el precio del chalet.', null, null,
     now() - interval '7 days', now() - interval '22 days'),
    (dag, c1, null, usr, 'cierre', 310000, null, true, null,
     now() - interval '10 days', now() - interval '45 days');

  -- ============ ACTIVIDADES ============
  insert into public.activities
    (agency_id, contact_id, deal_id, property_id, type, title, body, due_date, completed_at, created_by, created_at) values
    (dag, c3, null, p1, 'visita', 'Visita piso Chamberi', 'Recoger llaves y valorar reparaciones.', now() - interval '40 days', now() - interval '41 days', usr, now() - interval '42 days'),
    (dag, c3, null, null, 'tarea', 'Llamar a Antonio', 'Confirmar interes en la oferta.', now() - interval '2 days', null, usr, now() - interval '3 days'),
    (dag, c4, null, p2, 'visita', 'Visita villa La Moraleja', 'Acceso por conserje.', now() - interval '1 day', now() - interval '2 days', usr, now() - interval '2 days'),
    (dag, c5, null, p3, 'llamada', 'Seguimiento alquiler', 'Bajar la documentacion del contrato.', '2026-08-25 11:00:00+00', null, usr, now() - interval '1 day'),
    (dag, c5, null, p3, 'tarea', 'Redactar contrato', 'Contrato de alquiler Malasana.', '2026-08-28 09:00:00+00', null, usr, now() - interval '1 day'),
    (dag, c6, null, null, 'tarea', 'Primera llamada', 'Presentar el CRM a Elena.', '2026-08-27 10:00:00+00', null, usr, now() - interval '1 day');

  raise notice 'Demo cargada: 5 propiedades, 6 contactos, 5 deals, 6 actividades';
end $$;