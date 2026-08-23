# CRM Inmobiliario — Documento de Diseño

**Fecha:** 2026-08-22
**Estado:** Aprobado por el usuario (bloques 1 y 2)
**Versión:** 1.0

---

## 1. Visión general

CRM moderno, atractivo y funcional para agencias inmobiliarias, concebido como **plantilla multi-tenant**: una sola aplicación que sirve a múltiples inmobiliarias, cada una con sus datos aislados y su propio branding (nombre, logo, color primario).

El producto final se conectará más adelante a la web pública de cada inmobiliaria mediante un botón "Admin" en su menú principal (enlace al login del CRM). El control global del sistema permanece en manos del propietario del proyecto mediante un panel maestro.

Fuente de requisitos: `docs/Arquitectura, Diseño y Desarrollo de un CRM Especializado para Agencias Inmobiliarias.pdf` y `docs/Sobre el diseño de la interfaz para el crm inmobiliario.pdf`.

## 2. Alcance v1

### Incluido
- Autenticación y roles (3 niveles).
- Gestión de propiedades con fotos y ficha completa.
- Leads/contactos con ficha 360°.
- Pipeline Kanban de 5 etapas.
- Agenda/tareas y timeline de actividades.
- Dashboard con KPIs.
- Buscador universal.
- Formulario de captación web embebible por agencia.
- Panel maestro super_admin para gestionar agencias.
- Branding dinámico por agencia.

### Excluido (fases futuras)
- Sindicación XML a portales (Kyero/Idealista/Fotocasa).
- KYC/PBC/AML y firma electrónica.
- Integración WhatsApp Business API y telefonía.
- IA: scoring predictivo, matching automático, generación de textos.
- App móvil nativa (v1 es web responsive mobile-first).
- Multi-idioma (v1 en español) y multi-moneda (v1 en EUR €).

## 3. Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend + Backend | Next.js 15 (App Router), TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/contraseña + magic link) |
| Almacenamiento | Supabase Storage (fotos de propiedades, logos) |
| Seguridad multi-tenant | Row Level Security (RLS) por `agency_id` |
| Mapas | Leaflet + OpenStreetMap (react-leaflet), sin API key |
| Despliegue | Vercel (app) + Supabase Cloud |

### Modelo multi-tenant
- Tabla raíz `agencies`. Todas las tablas de negocio llevan `agency_id NOT NULL REFERENCES agencies(id)`.
- **RLS**: políticas `USING (agency_id = get_my_agency_id())`; función SQL `get_my_agency_id()` lee `profiles.agency_id` del `auth.uid()`. El rol `super_admin` tiene política de bypass (`is_super_admin()`).
- Storage: buckets organizados por `{agency_id}/…`, con políticas RLS equivalentes.
- El slug de agencia (`/a/{slug}` no es necesario en rutas internas: el contexto viene del usuario autenticado; el slug solo se usa en el formulario público).

### Roles y permisos

| Permiso | super_admin | admin | agent |
|---|---|---|---|
| Gestionar agencias (crear/editar/desactivar, branding) | ✅ | ❌ | ❌ |
| "Entrar como" una agencia (soporte) | ✅ | ❌ | ❌ |
| Ver/editar todos los datos de SU agencia | ✅* | ✅ | ❌ |
| Crear/editar usuarios de su agencia | ❌ | ✅ | ❌ |
| Contactos/deals asignados a él | ✅* | ✅ | ✅ |
| Configurar formulario web y branding propio | ❌ | ✅ | ❌ |

\* super_admin accede vía panel maestro/impersonación, no ve datos mezclados de todas las agencias en las vistas operativas.

## 4. Modelo de datos

Todas las tablas llevan `created_at`, `updated_at` (timestamptz, default now) salvo indicación.

### `agencies`
- `id uuid PK`, `name text`, `slug text UNIQUE` (usado en URL pública del formulario), `logo_url text NULL`, `primary_color text DEFAULT '#2563eb'`, `active boolean DEFAULT true`, `settings jsonb DEFAULT '{}'` (p. ej. `sla_hours_lead`, `pipeline_stage_days`).

### `profiles` (1:1 con `auth.users`)
- `id uuid PK = auth.users.id`, `agency_id uuid FK`, `role text CHECK IN ('super_admin','admin','agent')`, `full_name text`, `avatar_url text NULL`, `phone text NULL`.
- Los perfiles `super_admin` tienen `agency_id NULL`.

### `properties`
- `id uuid PK`, `agency_id`, `reference text` (generada: `REF-{secuencia}` única por agencia), `title text`, `description text NULL`,
- `property_type text` (piso, casa, villa, terreno, local, oficina, otro),
- `operation text CHECK ('venta','alquiler')`, `status text CHECK ('borrador','activo','reservado','vendido','retirado') DEFAULT 'borrador'`,
- `price numeric`, `bedrooms int NULL`, `bathrooms int NULL`, `surface_m2 numeric NULL`,
- `address text NULL`, `city text`, `zone text NULL`, `lat numeric NULL`, `lng numeric NULL`,
- `features text[] DEFAULT '{}'` (piscina, garaje, terraza…),
- `created_by uuid FK profiles`.
- Índices: `(agency_id, status)`, `(agency_id, operation)`.

### `property_images`
- `id uuid PK`, `property_id FK CASCADE`, `url text`, `position int`. Única restricción `(property_id, position)`.

### `contacts`
- `id uuid PK`, `agency_id`, `contact_type text CHECK ('comprador','inquilino','propietario') DEFAULT 'comprador'`,
- `full_name text`, `email text NULL`, `phone text`, `notes text NULL`,
- `source text CHECK ('web','manual','referido','portal') DEFAULT 'manual'`, `source_detail text NULL`,
- `status text CHECK ('nuevo','en_seguimiento','calificado','descartado','cerrado') DEFAULT 'nuevo'`,
- `budget_max numeric NULL`, `preferences jsonb DEFAULT '{}'` (zonas deseadas, tipos, hab. mínimas),
- `consent_rgpd boolean DEFAULT false`, `consent_at timestamptz NULL`,
- `assigned_to uuid NULL FK profiles`, `created_by uuid NULL`.
- Índice `(agency_id, status)`; búsqueda por teléfono normalizado.

### `deals`
- `id uuid PK`, `agency_id`, `contact_id FK CASCADE`, `property_id NULL FK` (SET NULL si se borra), `agent_id FK profiles`,
- `stage text CHECK ('nuevo_lead','calificado','visita','negociacion','cierre') DEFAULT 'nuevo_lead'`,
- `value numeric NULL` (oferta/presupuesto de la operación), `notes text NULL`,
- `stage_updated_at timestamptz DEFAULT now()` (para badges de inactividad),
- `lost_reason text NULL`, `won boolean NULL`.

### `activities`
Timeline unificada: interacciones registradas **y** tareas.
- `id uuid PK`, `agency_id`, `contact_id NULL FK CASCADE`, `deal_id NULL FK SET NULL`, `property_id NULL FK SET NULL`,
- `type text CHECK ('llamada','email','whatsapp','nota','visita','tarea','sistema')`,
- `title text`, `body text NULL`,
- `due_date timestamptz NULL` (solo tareas), `completed_at timestamptz NULL`,
- `created_by uuid FK profiles`.

## 5. Módulos y pantallas

Estética según guía UI/UX: fondos neutros (#F8F9FA claro o modo oscuro opcional), tipografía Inter, colores saturados solo para estados (verde=activo/cerrado, ámbar=reservado/pendiente, rojo=alerta SLA), miniaturas 16:9, drawer lateral, skeleton screens, responsive mobile-first.

### 5.1 Login
Pantalla centrada con logo/color de la agencia. Mecanismo v1 explícito: la URL admite `?agencia={slug}` y, si no viene, se muestra un buscador/seleccionador de agencia antes del formulario (fallback: branding genérico "CRM Inmobiliario"). El slug elegido queda recordado en localStorage para visitas siguientes.

### 5.2 Layout de aplicación
Sidebar colapsable (Dashboard, Propiedades, Contactos, Pipeline, Agenda, Configuración) + barra superior con buscador universal, botón "+ Crear", campana de avisos (tareas de hoy/vencidas y leads sin actividad >24 h, calculados on-demand, sin push real en v1) y menú de perfil. En móvil: bottom tab bar (Inicio, Propiedades, Contactos, Pipeline) + FAB "+".

### 5.3 Dashboard
- KPIs con tendencia semanal: leads nuevos, propiedades activas, visitas realizadas, valor del pipeline (suma de deals abiertos).
- Embudo simple de conversión por etapa del pipeline.
- Lista de tareas del día + alertas: leads sin actividad >24 h, tareas vencidas.
- Para `admin`: agregado de toda la agencia; para `agent`: solo lo suyo.

### 5.4 Propiedades
- Vista lista con filtros persistentes (texto, estado, operación, tipo, precio min/max, hab., m²) ordenable; tarjetas con foto principal, precio, ref, specs y badge de estado.
- Toggle lista/mapa: mapa Leaflet con marcadores; popup con mini-ficha y enlace a la ficha.
- Ficha (drawer desde lista; página completa para editar): galería drag-and-drop reordenable (subida múltiple a Storage con redimensionado cliente), pestañas *Datos generales*, *Visitas y feedback* (timeline filtrada). Acciones: cambiar estado (activar/reservar/vender/retirar), eliminar (soft: pasa a retirada).

### 5.5 Contactos (Leads)
- Tabla/lista con filtros (estado, origen, tipo, agente, texto libre sobre nombre/teléfono/email).
- Ficha 360° en drawer: columna izquierda perfil+preferencias+presupuesto; central timeline cronológica inversa de `activities`; derecha acciones fijas: registrar llamada, email, WhatsApp (abre wa.me, sin API en v1), nota, tarea, crear oferta (crea deal).

### 5.6 Pipeline
- Kanban 5 columnas (Nuevo → Calificado → Visita → Negociación → Cierre); drag-and-drop actualiza `stage` + `stage_updated_at`.
- Tarjeta: foto del inmueble vinculado, nombre contacto, presupuesto, avatar agente.
- Badge rojo cuando `now - stage_updated_at` supera `settings.pipeline_stage_days[etapa]` (configurable, default 7 días).
- Columna Cierre separa ganados/perdidos (marcar resultado + motivo).

### 5.7 Agenda/Tareas
- Vista día (lista cronológica) + mes (calendario simple); crear/completar/reprogramar tareas; tareas ligadas opcionalmente a contacto/inmueble.

### 5.8 Configuración (admin)
- Usuarios: invitar por email (magic link), cambiar rol, desactivar.
- Branding: nombre, logo, color primario (preview en vivo).
- Formulario web: activar/desactivar, campos visibles, mensaje post-envío, snippet de incrustación copiable.

### 5.9 Panel maestro (super_admin)
- CRUD de agencias (con branding y settings), activar/desactivar acceso.
- Métricas básicas por agencia (nº usuarios, propiedades, contactos, deals).
- Impersonación: sesión temporal "entrar como" admin de una agencia, con banner visible y salida limpia (audit log mínimo en tabla `impersonation_logs`: quién, a qué agencia, cuándo).

### 5.10 Buscador universal
Búsqueda unificada en top bar: propiedades (ref, título, dirección, ciudad) y contactos (nombre, teléfono, email). Resultados agrupados por tipo, navegación directa.

## 6. Formulario de captación web

- Endpoint público: `POST /api/public/leads/{slug}` + página alojada `/form/{slug}` embebible vía `<iframe>`.
- Campos base: nombre*, teléfono*, email, mensaje; configurables (mostrar/ocultar email/mensaje).
- Seguridad: honeypot anti-bots, rate limit por IP (p. ej. 5/min), validación server-side, CORS restringido configurable.
- Efecto: crea `contact` (source='web', consentimiento RGPD registrado con timestamp) + `activity` tipo 'sistema' con el mensaje. Si existe teléfono duplicado en la misma agencia, se añade actividad al existente en lugar de duplicar.
- Notificación: email al admin(s) de la agencia con cada lead nuevo (Resend o similar; configurable).

## 7. Errores y estados límite

- Skeleton screens en cargas iniciales; empty states ilustrados con CTA ("Crea tu primera propiedad").
- Validación con Zod en formularios (cliente y server actions/API).
- Manejo de errores de mutaciones con toasts; confirmación en acciones destructivas.
- Sesión expirada → redirect a login preservando destino.
- Agencia desactivada → login bloqueado con mensaje claro.

## 8. Testing

- Unitarios: utilidades puras (formateo moneda/fechas, generación referencia, cálculo badges SLA) con Vitest.
- Integración: policies RLS verificadas con script SQL de prueba (usuario de agencia A no ve datos de B; agent solo ve lo suyo donde aplique).
- E2E smoke (Playwright): login, crear propiedad con foto, crear lead, mover deal en Kanban, envío del formulario público crea contacto.

## 9. Despliegue y operación

- Vercel (variables: `NEXT_PUBLIC_SUPABASE_URL`, claves anon/service_role, clave Resend).
- Migraciones versionadas (supabase CLI / archivos SQL en repo).
- Primer arranque: seed de super_admin + agencia demo con datos de ejemplo para validar la plantilla.

## 10. Criterios de éxito

1. Dos agencias creadas desde el panel maestro ven exclusivamente sus propios datos (verificado por RLS).
2. Flujo completo funciona end-to-end: captar lead por web → llamar/nota → crear oferta → arrastrar por pipeline → cerrar como ganado → propiedad pasa a vendida.
3. Branding cambia por agencia sin tocar código.
4. Interfaz usable en móvil (agentes en campo) según guía UI/UX.
