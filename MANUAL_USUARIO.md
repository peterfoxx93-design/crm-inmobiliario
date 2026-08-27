# CRM Inmobiliario — Manual de Usuario

> **Versión:** 1.0 — MVP Gates PASS 27-08-2026
> **Producción:** `https://crm-inmobiliario-phi-two.vercel.app`
> **Para:** agentes, administradores de agencia y super-admin (Maestro)
> **Idioma:** español (UI 100% en español, importes en EUR)

---

## Índice

1. [Introducción](#1-introducción)
2. [Para quién es este manual](#2-para-quién-es-este-manual)
3. [Requisitos](#3-requisitos)
4. [Acceso y primer inicio](#4-acceso-y-primer-inicio)
5. [Navegación](#5-navegación)
6. [Dashboard](#6-dashboard)
7. [Propiedades](#7-propiedades)
8. [Contactos](#8-contactos)
9. [Pipeline de ofertas](#9-pipeline-de-ofertas)
10. [Agenda](#10-agenda)
11. [Ajustes de agencia](#11-ajustes-de-agencia)
12. [Panel Maestro (solo super_admin)](#12-panel-maestro-solo-super_admin)
13. [Formulario web público](#13-formulario-web-público)
14. [Flujos paso a paso](#14-flujos-paso-a-paso)
15. [Roles y permisos](#15-roles-y-permisos)
16. [Buenas prácticas](#16-buenas-prácticas)
17. [Solución de problemas](#17-solución-de-problemas)
18. [FAQ](#18-faq)
19. [Soporte y actualizaciones](#19-soporte-y-actualizaciones)

---

## 1. Introducción

### ¿Qué es el CRM Inmobiliario?

Un CRM multi-agencia para inmobiliarias. Con una sola instalación sirve a varias agencias; cada agencia ve **solo sus datos** (aislamiento por Row Level Security en Postgres, no por filtros de la app). Incluye:

- Gestión de propiedades con galería (hasta 5 MB por imagen) y mapa
- Contactos con línea de tiempo de actividades
- Pipeline Kanban de ofertas
- Agenda de visitas
- Dashboard de indicadores
- Formulario público embebible para captar leads desde la web de la agencia
- Panel **Maestro** para dar de alta y administrar agencias

> **Captura pendiente:** `![Dashboard general](docs/screenshots/dashboard.png)`

### ¿Qué resuelve?

Centraliza captación web → contacto → visita → oferta → cierre, con trazabilidad y sin fugas entre agencias.

---

## 2. Para quién es este manual

| Perfil | Usa | Necesita leer |
|---|---|---|
| **Agente** | Propiedades, Contactos, Pipeline, Agenda | §5–10, §14 |
| **Administrador de agencia** | Todo lo anterior + Ajustes (branding, usuarios, captación) | §5–11, §14–15 |
| **Super admin (Maestro)** | Alta/baja de agencias, suplantación | §12 + todo |

---

## 3. Requisitos

- **Navegador:** Chrome / Edge / Firefox / Safari actualizado (móvil y escritorio)
- **Cuenta:** email + contraseña **o** enlace mágico (ver §4)
- **Agencia activa:** tu usuario debe pertenecer a una agencia en estado **Activa**; si está Desactivada verás `Esta agencia no está disponible` al intentar entrar
- **Imágenes:** JPG, PNG, WEBP, GIF, AVIF — máx. **5 MB** por archivo. El servidor acepta lotes de **hasta 10 MB** por subida

> **Nota técnica:** no necesitas instalar nada. Todo funciona en el navegador.

---

## 4. Acceso y primer inicio

### 4.1 Entrar por tu agencia

Cada agencia tiene su **slug** (ej. `fincas-mediterraneo`, `demo`). El acceso siempre pasa por él para mostrar tu marca.

**Opción A — link directo (recomendado):**

```
https://crm-inmobiliario-phi-two.vercel.app/login?agencia=TU-SLUG
```

1. Abre el link (guárdalo en favoritos)
2. Verás tu logo, nombre y color arriba del formulario
3. Introduce **email** y **contraseña** → **Entrar**
4. Si tu usuario es nuevo sin contraseña: deja el password vacío y pulsa **Recibir enlace mágico por correo** (ver 4.2)

**Opción B — entrada genérica:**

1. Ve a `/login` sin `?agencia=`
2. Primero te pide el **identificador de agencia** (el slug) → escríbelo → verás el branding
3. Luego el formulario de credenciales

> **Tip:** el slug queda recordado en el navegador; la próxima vez el login ya mostrará tu marca.

### 4.2 Primer acceso sin contraseña (invitados)

Las cuentas invitadas se crean **confirmadas pero sin contraseña**.

1. En el login de tu agencia, introduce tu **email**
2. Pulsa **Recibir enlace mágico por correo**
3. Abre el email (revisa Spam) y pulsa el link → entrarás directo a `/dashboard`
4. Luego fija tu contraseña: ve a tu perfil o usa **Recuperación** desde el login

**Alternativa admin:** el super_admin puede enviarte **Recuperación de contraseña** desde Supabase Dashboard → Authentication → Users → tu usuario → *Send password recovery*.

### 4.3 Recuperar / cambiar contraseña

- En `/login` → **¿Olvidaste tu contraseña?** → introduce email → recibirás el enlace
- Los enlaces mágicos caducan en **60 minutos** y son de **un solo uso**

### 4.4 Casos de bloqueo

| Mensaje | Causa | Qué hacer |
|---|---|---|
| `Esta agencia no está disponible o está desactivada` | Agencia **Desactivada** desde Maestro | Contacta al super_admin |
| `No tienes ninguna agencia activa` (solo super_admin) | Eres super_admin sin suplantar y probaste crear/invitar | Ve a `/maestro` → **Suplantar** la agencia → verás el banner ámbar |
| `Enlace inválido o caducado` | Magic link usado o >60' | Pide otro |

---

## 5. Navegación

### Escritorio

- **Sidebar izquierdo** con: Dashboard, Propiedades, Contactos, Pipeline, Agenda, Ajustes. El logo y color cambian según tu agencia
- Botón **colapsar** (icono flecha) deja solo iconos
- **Avatar arriba a la derecha** → perfil / cerrar sesión

### Móvil

- **Bottom tab** con 5 iconos + **FAB +** (crear propiedad/contacto rápido)
- Misma información, layout apilado

### Atajos de teclado

| Atajo | Acción |
|---|---|
| `Tab` / `Shift+Tab` | Navegar entre campos |
| `Enter` | Confirmar diálogo |
| `Esc` | Cerrar diálogo / drawer |
| `Ctrl/Cmd + K` (si aparece) | Búsqueda rápida |

> **Captura pendiente:** `![Sidebar desktop](docs/screenshots/sidebar-desktop.png)` y `![Bottom tab móvil](docs/screenshots/bottom-tab-mobile.png)`

---

## 6. Dashboard

Ruta: `/dashboard`

- **KPIs:** propiedades activas, contactos nuevos, ofertas por etapa, visitas de la semana
- **Actividad reciente:** últimas altas/cambios
- **Alertas SLA:** leads sin atender > horas configuradas en Ajustes → Captación

> **Consejo:** úsalo como punto de partida cada mañana.

---

## 7. Propiedades

Ruta: `/propiedades` (lista) · `/propiedades/nuevo` (alta) · `/propiedades/[id]` (ficha)

### 7.1 Listado

- **Filtros:** buscador (título / referencia / ciudad), Estado (borrador, publicado, reservado, vendido, retirado), Operación (venta/alquiler), Tipo, Precio mín/máx
- **Paginación:** 12 por página, orden estable por fecha + id
- **Tarjetas:** foto principal (o placeholder), referencia, precio EUR, ciudad, estado con color
- **Vista mapa:** toggle mapa/listado

> **Tip:** escribe en el buscador `REF-0001` para saltar directo a una referencia.

### 7.2 Crear propiedad

1. Pulsa **+ Nueva propiedad** (desktop) o **FAB +** (móvil)
2. Rellena **Datos** (obligatorios marcados con *):
   - Título, Referencia (única por agencia), Ciudad, Dirección, Precio, Operación, Tipo, Habitaciones, Baños, Superficie, Descripción
3. **Estado inicial:** `borrador` (recomendado) → luego `publicado`
4. Pulsa **Guardar** → irás a la **ficha** de la propiedad

> **Aviso:** si ves `No tienes ninguna agencia activa`, eres super_admin sin suplantar → ve a `/maestro` → Suplantar.

### 7.3 Ficha — pestañas

La ficha tiene 3 pestañas superiores:

| Pestaña | Qué muestra |
|---|---|
| **Datos** | Formulario editable + mapa + acciones (cambiar estado, archivar) |
| **Galería** | Subir / reordenar / borrar fotos |
| **Visitas** | Timeline de actividades y visitas asociadas |

#### Galería (importante)

- Solo en la ficha, pestaña **Galería** → botón **Subir fotos** (`Subir imágenes`)
- Arrastra o selecciona varias a la vez (cada una ≤5 MB, lote ≤10 MB)
- Las fotos se guardan en `property-images/{agencia}/{propiedad}/`
- Reordena arrastrando; borra con el icono papelera → confirma
- **Si la subida se queda en "subiendo…"**: el archivo supera el límite del navegador; comprime o reduce a <5 MB

> **Captura pendiente:** `![Ficha Galería](docs/screenshots/property-gallery.png)`

### 7.4 Cambiar estado

En la ficha → **Datos** → selector de estado:

`borrador → publicado → reservado → vendido` · `retirado` archiva (no aparece en `listPropertyOptions` del Pipeline)

Cada cambio deja una entrada en **Visitas** (auditoría tipo `sistema`).

---

## 8. Contactos

Ruta: `/contactos`

### 8.1 Listado

Columnas: **Contacto | Teléfono | Email | Estado | Origen | Presupuesto | Agente | Última actividad**

- **Estados:** `Nuevo` → `En seguimiento` → `Calificado` → `Descartado` / `Cerrado`
- **Origen:** `manual` (creado en CRM) o `web` (captado por formulario público) + `consent_rgpd`
- **Filtros:** estado, origen, buscador

### 8.2 Crear contacto

1. **+ Nuevo contacto** → nombre, teléfono (E.164 recomendado `+34...`), email, estado, presupuesto, notas
2. Guardar → aparece en la tabla

### 8.3 Drawer (ficha lateral)

Pulsa cualquier fila → se abre el **drawer** (360 px en desktop, pantalla completa en móvil):

- **Arriba — Acciones rápidas** (siempre visibles):
  - **Oferta** → abre diálogo para crear una oferta en el Pipeline vinculada a este contacto
  - **WhatsApp** → abre `wa.me/{teléfono}` con el número del contacto
- **Centro — Perfil:** datos editables, origen, consentimientos, fechas
- **Abajo — Timeline:** actividades, notas, cambios de estado y visitas

> **Corrección 27-08:** el drawer antes ocultaba el botón Oferta bajo un grid de 3 columnas; ahora está apilado con borde superior para que **Oferta siempre se vea arriba**.
>
> **Captura pendiente:** `![Drawer contacto](docs/screenshots/contact-drawer.png)`

### 8.4 Contactos web (RGPD)

Los contactos con `origen=web` vienen de `/form/[slug]` o `POST /api/public/leads/[slug]`. Guardan `consent_rgpd=true` y `consent_at`. No se mezclan entre agencias: un lead de `fincas-mediterraneo` nunca aparece en `demo`.

---

## 9. Pipeline de ofertas

Ruta: `/pipeline` — tablero Kanban

### 9.1 Columnas (etapas configurables en Ajustes)

`Nuevo lead → Contactado → Visita programada → Visita realizada → Oferta → Cierre` (nombres pueden variar por agencia)

### 9.2 Crear oferta

Dos caminos:

**A. Desde Contactos (recomendado):**

1. Abre el contacto → **Oferta**
2. Elige la propiedad (`REF-...` — solo propiedades no retiradas de tu agencia)
3. Importe y notas → **Crear** → la tarjeta aparece en `Nuevo lead` con la referencia de la propiedad

**B. Desde Pipeline:**

1. **+ Nueva oferta** en la columna deseada → elige contacto y propiedad

### 9.3 Mover ofertas

- **Arrastra** la tarjeta entre columnas (drag & drop) → el cambio se guarda al soltar
- O abre la tarjeta → cambia **Etapa** → Guardar

> **Tip:** las tarjetas muestran **Contacto → Referencia propiedad** (ej. `Juan Rodriguez → REF-0001`) para identificar el cruce.

> **Captura pendiente:** `![Pipeline Kanban](docs/screenshots/pipeline-kanban.png)`

---

## 10. Agenda

Ruta: `/agenda`

- Lista de **visitas** (fecha, hora, propiedad, contacto, agente, estado)
- Filtros por fecha, agente y estado
- **Nueva visita:** desde ficha de propiedad (pestaña Visitas) o desde Contacto → agenda

> Cada visita crea también una entrada en la timeline del contacto y de la propiedad.

---

## 11. Ajustes de agencia

Ruta: `/ajustes?tab=branding|usuarios|captacion` — solo **Administrador** de la agencia

### 11.1 Branding (`?tab=branding`)

- **Nombre, logo (URL), color** → preview en vivo del login y del sidebar
- Guardar → el cambio se refleja inmediato en `/login?agencia=TU-SLUG`

### 11.2 Usuarios (`?tab=usuarios`)

- **Invitar usuario:** nombre, email, rol (Administrador / Agente) → **Crear invitación**
- La cuenta queda **confirmada sin contraseña** → el invitado entra por **enlace mágico** o por **recuperación de contraseña** (ver §4.2)
- Lista de usuarios con rol y estado

### 11.3 Captación web (`?tab=captacion`)

- Toggle **Formulario de contacto público**
- Campos configurables: mostrar/ocultar email y mensaje
- **Mensaje de gracias** personalizable (ej. `Gracias por contactar con Fincas Mediterráneo`)
- Botón **Copiar código** → genera el iframe para la web (ver §13)

---

## 12. Panel Maestro (solo super_admin)

Ruta: `/maestro` — visible solo si tu `role=super_admin`

### 12.1 Crear agencia

1. **+ Nueva agencia**
2. Nombre, slug (auto-generado si lo dejas vacío), logo, color, SLA de lead, días por etapa, formulario web
3. Guardar → aparece en la tabla con contadores a 0 y estado **Activa**

### 12.2 Suplantar (impersonar)

1. En la tabla, fila de la agencia → **Suplantar**
2. Verás el **banner ámbar fijo** `Estás viendo {Agencia} · Salir` en todo el shell
3. Operas como si fueras de esa agencia (crear propiedades, invitar usuarios, etc.)
4. **Salir** en el banner → vuelves a Maestro. Mientras suplantas, `/maestro` redirige a `/dashboard`

> Cada suplantación queda auditada en `impersonation_logs` (inicio/cierre). Consulta: `select * from impersonation_logs order by started_at desc limit 10;`

### 12.3 Desactivar agencia

- **Desactivar** → confirma en diálogo → la agencia pasa a **Inactiva**
- Efectos inmediatos:
  - `GET /api/public/leads/{slug}` → `404 AGENCY_UNAVAILABLE`
  - `/form/{slug}` → `No disponible`
  - `/login?agencia={slug}` → `Esta agencia no está disponible`
- **Reactivar** revierte lo anterior

---

## 13. Formulario web público

### 13.1 URL y embed

- URL directa: `https://crm-inmobiliario-phi-two.vercel.app/form/{slug}`
- Embed (snippet de Ajustes → Captación → Copiar código):

```html
<iframe src="https://crm-inmobiliario-phi-two.vercel.app/form/{slug}" style="width:100%;height:640px;border:0;border-radius:12px"></iframe>
```

- Solo funciona con **Captación activa** y **agencia Activa**; si no, muestra `No disponible`
- Endpoint API: `POST https://crm-inmobiliario-phi-two.vercel.app/api/public/leads/{slug}`

### 13.2 Qué hace cada envío

- Crea o deduplica un contacto en **esa agencia** con `origen=web`, `consent_rgpd=true`
- Visible en `/contactos` en segundos
- Aviso por email a admins: **best-effort** (requiere `RESEND_API_KEY`; si falla, el lead queda guardado igual)

### 13.3 Botón Admin en la web del cliente

```html
<a href="https://crm-inmobiliario-phi-two.vercel.app/login?agencia={slug}">Admin</a>
```

Preselecciona la agencia en el login y recuerda el slug.

---

## 14. Flujos paso a paso

### Flujo 1 — Alta express de agencia (super_admin)

1. `/maestro` → **Nueva agencia** → nombre `Fincas Mediterráneo`, slug `fincas-mediterraneo`, color `#0ea5e9` → Guardar
2. **Suplantar** Fincas → `/ajustes?tab=usuarios` → **Invitar usuario** `admin@fincas-mediterraneo.es` Administrador → **Salir**
3. Invitado entra por `.../login?agencia=fincas-mediterraneo` → **enlace mágico** → ya opera

### Flujo 2 — Crear tu primera propiedad con fotos

1. `/propiedades/nuevo` → rellena Datos → **Guardar** (queda en `borrador`)
2. En la ficha → pestaña **Galería** → **Subir fotos** → selecciona 2–5 imágenes ≤5 MB → verifica miniaturas
3. Vuelve a **Datos** → cambia estado a `publicado` → Guardar

### Flujo 3 — Capta un lead desde la web

1. `/ajustes?tab=captacion` → activa formulario → **Copiar código** → pégalo en la web
2. Haz un envío de prueba en `/form/{slug}` con nombre + teléfono + consent → verifica en `/contactos` que aparece con `origen=web`

### Flujo 4 — De lead a oferta

1. `/contactos` → abre el lead → arriba pulsa **Oferta** → elige propiedad `REF-...` → Crear
2. Ve a `/pipeline` → verás la tarjeta `Nombre → REF-...` en `Nuevo lead`

### Flujo 5 — Visita y cierre

1. En `/pipeline` arrastra la tarjeta a `Visita programada`
2. Crea la visita en `/agenda` o desde la ficha de la propiedad → fecha/hora
3. Tras la visita, mueve a `Oferta` / `Cierre` y actualiza estado del contacto a `Cerrado`

### Flujo 6 — Desactivar una agencia (offboarding)

1. `/maestro` → fila → **Desactivar** → confirma → verifica que su `/form/{slug}` da `No disponible`

---

## 15. Roles y permisos

| Acción | Agente | Admin agencia | Super admin (sin suplantar) | Super admin (suplantando) |
|---|:---:|:---:|:---:|:---:|
| Ver Dashboard / Propiedades / Contactos / Pipeline / Agenda | ✅ | ✅ | ✅ (ve todas las agencias agregadas) | ✅ (solo agencia suplantada) |
| Crear/editar propiedad, subir fotos | ✅ | ✅ | ❌ `No tienes agencia activa` | ✅ |
| Crear contacto / oferta / visita | ✅ | ✅ | ❌ | ✅ |
| Gestionar Ajustes (branding, captación, usuarios) | ❌ | ✅ | ❌ | ✅ |
| Ver `/maestro`, crear/suplantar/desactivar agencias | ❌ | ❌ | ✅ | — (`/maestro` redirige a `/dashboard`) |
| Formulario público | público (si activo) | público | público | público |

> **Aislamiento:** RLS `agency_isolation` impide que un usuario de agencia A lea/escriba filas de B por URL directa (`/propiedades/{id-de-B}` → 404). El super_admin sin suplantar ve agregado para auditoría; suplantando ve solo la agencia.

---

## 16. Buenas prácticas

- **Referencias únicas:** usa prefijo claro (`REF-`, `VM-`) y numera correlativo
- **Fotos:** primera foto = portada; reordena para destacar la mejor al abrir ficha
- **Contactos:** guarda el teléfono en `+34...` para que **WhatsApp** funcione directo
- **Pipeline:** mueve la tarjeta al terminar la acción, no antes; deja nota en la timeline
- **SLA:** revisa `/dashboard` cada mañana para leads `web` sin atender

---

## 17. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `middleware` warn en `npm run build` | Aviso Next 16 (middleware→proxy) | Inofensivo, no bloquea deploy. Migrable con `npx @next/codemod@canary middleware-to-proxy` |
| `No tienes ninguna agencia activa` | Super_admin sin suplantar intenta crear | `/maestro` → **Suplantar** → banner ámbar |
| Subida se queda en `subiendo…` | Archivo >5 MB o lote >10 MB | Comprime/reduce y reintenta en **Galería** |
| Enlace mágico no llega | SMTP compartido de Supabase o Site URL mal | Revisa Spam; en prod configura SMTP propio y verifica `Site URL` + `Redirect /auth/callback` |
| `Esta agencia no está disponible` | Agencia Desactivada | Pide reactivación al super_admin |
| Lead no crea email | Sin `RESEND_API_KEY` o dominio no verificado | El lead **sí se guarda**; configura Resend para avisos |
| Migración falla en Storage | Permisos `storage.buckets` | Crea buckets `property-images` y `branding` públicos a mano y aplica solo sección 7 de `0001_schema.sql` |
| Lateral con poco contraste | Tema claro | Actualizado 27-08 en `globals.css`/`Sidebar.tsx` (sidebar 0.968, accent 0.92) — Ctrl+Shift+R |

---

## 18. FAQ

**¿El enlace mágico es seguro?**
Sí: un solo uso, caduca en 60', va por email al titular de la cuenta.

**¿Puedo tener dos agencias con el mismo email?**
No. El email es único en `auth.users`; cada persona pertenece a una agencia (o ninguna si es super_admin).

**¿Cómo cambio el branding después?**
`/ajustes?tab=branding` (admin) → edita nombre/logo/color → Guardar → el login ya muestra el nuevo.

**¿El formulario embebido es RGPD válido?**
Sí si lo activas con el checkbox de consentimiento (literal configurable en Ajustes). Cada lead guarda `consent_rgpd` + `consent_at`.

**¿Puedo desactivar y reactivar?**
Sí, desde `/maestro` sin perder datos; solo bloquea accesos y formularios.

**¿Veo propiedades de otra agencia por URL?**
No: RLS + filtro `agency_id` lo impide → 404. El super_admin sin suplantar ve agregado (auditoría); suplantando ve solo la agencia.

---

## 19. Soporte y actualizaciones

- **Deploy:** Vercel (Root `crm`), Supabase proyecto `phvirucslmmnkrcebtas`
- **Tag vigente:** `v1.0-gates-pass` + fixes `a6af170` (10 MB), `48ea161` (drawer), `105a25e` (sidebar)
- **Runbook operativo:** `OPERATIONS.md` (onboarding/offboarding, monitor, backups, despliegues)
- **Verificación prod:** `crm/supabase/VERIFY.md` §E2E + checklist multi-agencia en `README.md`
- **Contacto soporte:** super_admin `peterfoxx93@gmail.com` (o tu canal interno) — indica slug de agencia + captura del error + hora

> **Capturas pendientes de añadir:** dashboard, listado propiedades, ficha galería, drawer contacto, pipeline, form público, maestro. Guarda PNG en `docs/screenshots/` con los nombres indicados arriba.

---

*Fin del manual — MVP 1.0 cerrado 27-08-2026. Para una nueva agencia, sigue el Flujo 1 (§14) y el snippet de §13.*
