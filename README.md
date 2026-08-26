# CRM Inmobiliario

CRM multi-agencia (multi-tenant) para inmobiliarias: gestión de propiedades con
galería y mapa, contactos con timeline de actividades, pipeline de ofertas,
agenda, dashboard de indicadores, formulario público de captación web embebible
y panel maestro para dar de alta y administrar cada agencia cliente.

Stack: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 +
Supabase (Postgres con RLS, Auth y Storage) + Resend para emails, desplegado en
Vercel. Tests con Vitest (unit/componente) y Playwright (E2E).

---

## Índice

1. [Qué es](#qué-es)
2. [Desarrollo local](#desarrollo-local)
3. [Despliegue en producción (Vercel + Supabase)](#despliegue-en-producción-vercel--supabase)
4. [Alta de una inmobiliaria cliente](#alta-de-una-inmobiliaria-cliente)
5. [Conexión con la web del cliente](#conexión-con-la-web-del-cliente)
6. [Verificación multi-agencia en producción](#verificación-multi-agencia-en-producción)
7. [Gates pendientes antes de cerrar el MVP](#gates-pendientes-antes-de-cerrar-el-mvp)
8. [Solución de problemas](#solución-de-problemas)

---

## Qué es

Una única instancia sirve a varias inmobiliarias. Cada agencia ve solo sus
datos (aislamiento garantizado por Row Level Security de Postgres, no por la
aplicación). Un perfil `super_admin` administra las agencias desde el panel
**Maestro** (`/maestro`) y puede suplantar una agencia para operar en su
nombre, con registro de auditoría en base de datos.

Módulos principales (rutas reales de la app):

| Módulo | Ruta | Acceso |
|---|---|---|
| Login con branding de agencia | `/login` | Público |
| Formulario público de captación | `/form/[slug]` | Público (iframe) |
| Endpoint público de leads | `POST /api/public/leads/[slug]` | Público |
| Dashboard de indicadores | `/dashboard` | Sesión |
| Propiedades (lista/mapa/ficha/nueva) | `/propiedades`, `/propiedades/[id]`, `/propiedades/nuevo` | Sesión |
| Contactos | `/contactos` | Sesión |
| Pipeline de ofertas | `/pipeline` | Sesión |
| Agenda | `/agenda` | Sesión |
| Ajustes de agencia (branding, usuarios, captación web) | `/ajustes?tab=branding\|usuarios\|captacion` | Admin de agencia |
| Panel maestro multi-agencia | `/maestro` | Solo super_admin |

---

## Desarrollo local

### Prerrequisitos

- Node.js 20 o superior y npm.
- Una cuenta gratuita de Supabase con un proyecto creado.

### Pasos

1. Copia las variables de entorno y rellénalas con los valores de tu proyecto
   Supabase (Dashboard → Project Settings → API):

   ```powershell
   Copy-Item crm\.env.example crm\.env.local
   ```

2. Instala dependencias y arranca el servidor de desarrollo:

   ```powershell
   cd crm
   npm install
   npm run dev
   ```

3. Abre `http://localhost:3000`.

### Base de datos en desarrollo

Para escribir código no necesitas migrar nada. Para probar la aplicación de
verdad sí: no hay CLI de migraciones en este proyecto, el esquema se ejecuta
pegando SQL en el SQL Editor del Dashboard de Supabase. Sigue los pasos A-D de
[`crm/supabase/VERIFY.md`](crm/supabase/VERIFY.md):

- Paso A: esquema completo (`crm/supabase/migrations/0001_schema.sql`),
  incluye los buckets públicos de Storage `property-images` y `branding`.
- Paso B (opcional): sembrar la agencia demo (`crm/supabase/seed.sql`, slug
  `demo`). Útil para desarrollo y para el E2E.
- Paso C: convertir tu usuario en `super_admin`.
- Paso D: verificación final.

Comandos útiles (dentro de `crm/`):

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test -- --run` | Suite Vitest (baseline actual: 463 tests / 35 archivos) |
| `npm run test:e2e` | E2E Playwright (requiere BD migrada; ver runbook) |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción |

Las variables `E2E_EMAIL` / `E2E_PASSWORD` / `E2E_AGENCY` solo afectan al test
E2E; sus valores por defecto son `admin@demo.es` / `Demo1234!` / agencia `demo`
(creación de ese usuario: ver runbook E2E en `crm/supabase/VERIFY.md` §E2E — pasos:
1) migrar `0001_schema.sql` + `seed.sql`, 2) `Add user admin@demo.es/Demo1234!` + `update profiles set agency_id=(select id from agencies where slug='demo')`, 3) `npm run build`, 4) `npx playwright install chromium`, 5) `npm run test:e2e` ×2 PASS).

---

## Despliegue en producción (Vercel + Supabase)

> Estos pasos requieren tus cuentas de Supabase y Vercel: son operaciones que
> hace una persona, no este repositorio. Sustituye `TU-DOMINIO` por tu dominio
> final (por ejemplo `https://tu-crm.vercel.app` o tu dominio propio).

### Paso 1 · Proyecto Supabase de producción

1. Crea un proyecto nuevo en Supabase (elige región cercana a tus usuarios).
2. Abre **SQL Editor** y pega el contenido íntegro de
   [`crm/supabase/migrations/0001_schema.sql`](crm/supabase/migrations/0001_schema.sql).
   Pulsa **Run**. Resultado esperado: éxito sin filas devueltas.
   Si falla al final en el bloque de Storage por permisos sobre
   `storage.buckets`, crea a mano los buckets `property-images` y `branding`
   (**Storage → New bucket**, marcados como **Public**) y vuelve a pegar solo
   la sección 7 del archivo (detalle en el paso A de `crm/supabase/VERIFY.md`).
3. Ejecuta [`crm/supabase/seed.sql`](crm/supabase/seed.sql) **solo si quieres**
   la agencia demo (`demo`) en producción. Para un despliegue limpio de
   clientes reales, sáltatelo.
4. Crea tu usuario super_admin (paso C de `VERIFY.md`):
   - **Authentication → Users → Add user**: tu email real, contraseña segura y
     marca **Auto Confirm User**. El trigger `on_auth_user_created` crea tu
     perfil con rol `agent`.
   - En **SQL Editor** promuévalo a super_admin:

     ```sql
     insert into public.profiles (id, agency_id, role, full_name)
     select id, null, 'super_admin', '<tu nombre>'
     from auth.users where email = '<tu-email>';
     ```

     Si falla porque el trigger ya creó el perfil, usa la versión equivalente:

     ```sql
     update public.profiles
     set role = 'super_admin', agency_id = null
     where id = (select id from auth.users where email = '<tu-email>');
     ```
5. Configura Auth para producción (**Authentication → URL Configuration**):
   - **Site URL**: `https://TU-DOMINIO`
   - **Redirect URLs**: añade `https://TU-DOMINIO/auth/callback`
   
   Los enlaces mágicos y callbacks redirigen a `{origen}/auth/callback`; si
   esta URL no está registrada, el login por enlace mágico fallará.
6. (Recomendado en producción) Configura un SMTP propio en
   **Authentication → Emails**: el remitente compartido de Supabase tiene
   límites estrictos de envío, y el acceso por enlace mágico depende de esos
   emails.

### Paso 2 · Proyecto en Vercel

1. Importa el repositorio en Vercel (**Add New → Project**) y configura
   **Root Directory**: `crm` (la app vive en la subcarpeta `crm/`).
2. Declara estas variables de entorno para el entorno **Production**
   (Project → Settings → Environment Variables):

   | Variable | Dónde se obtiene | Sensibilidad |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Pública |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | Pública (RLS limita su alcance) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role | **SECRETA.** Solo servidor (route handlers/server actions); da acceso total saltándose RLS. No exponer jamás |
   | `NEXT_PUBLIC_APP_URL` | Tu dominio público, sin barra final (`https://TU-DOMINIO`) | Pública |
   | `RESEND_API_KEY` | resend.com → API Keys | Secreta. Opcional: sin ella la app funciona y los leads se guardan, pero no llega el email de aviso |
   | `LEADS_EMAIL_FROM` | Remitente de los avisos de lead (por ejemplo `"CRM <leads@tudominio.com>"`) | Pública. Opcional: por defecto usa el sandbox de Resend |

   Nota sobre `NEXT_PUBLIC_APP_URL`: hoy ningún módulo del código la lee (los
   redirects se construyen con el origen de la petición). Su valor correcto
   importa porque documenta el dominio canónico de la app y debe coincidir con
   lo que configures como **Site URL** y **Redirect URLs** en Supabase Auth.

3. Pulsa **Deploy**.
4. Primer login: abre `https://TU-DOMINIO/login`. La pantalla pide primero el
   identificador (slug) de una agencia: introduce el slug de cualquier agencia
   activa existente (por ejemplo `demo` si sembraste el seed) para pasar al
   formulario de credenciales. El branding mostrado será el de esa agencia,
   pero tu sesión de super_admin es global: entrarás al panel completo con
   acceso a `/maestro`.

---

## Alta de una inmobiliaria cliente

Proceso operativo completo, desde el panel maestro hasta dejar la cuenta
funcionando. Requiere estar autenticado como super_admin.

### 1. Crear la agencia

1. Entra en `/maestro` (solo visible para super_admin).
2. Pulsa **Nueva agencia** y rellena el diálogo:
   - **Nombre** comercial.
   - **Identificador (slug)**: puedes dejarlo vacío; si lo haces se genera
     automáticamente a partir del nombre (minúsculas, guiones). Es el valor
     que usarás en la URL de login del cliente y en su formulario web.
   - **Logo** (URL de imagen) y **color** de marca, con vista previa en vivo.
   - **SLA de lead** (horas máximas antes de alerta) y **días por etapa** del
     pipeline.
   - **Formulario web**: activable aquí o después desde Ajustes (campos email
     y mensaje visibles, mensaje de agradecimiento).
3. Guarda. La agencia queda creada y **activa**.

### 2. Invitar a su usuario administrador

La invitación se hace desde Ajustes actuando EN el contexto de esa agencia:

1. En `/maestro`, pulsa **Suplantar** en la fila de la agencia. Verás el
   banner ámbar fijo «Estás viendo {agencia} · Salir» en todo el shell: es la
   señal de que operas como esa agencia (y queda auditado en
   `impersonation_logs`).
2. Ve a `/ajustes?tab=usuarios` y pulsa **Invitar usuario**.
3. Introduce nombre, email y rol **Administrador** (rol mínimo necesario para
   que gestionen sus propios usuarios y branding). Confirma con **Crear
   invitación**.
4. Desimpersona pulsando **Salir** en el banner ámbar antes de seguir con otra
   tarea.

**Importante, cómo entra el invitado (comportamiento real):** la invitación
crea la cuenta ya confirmada, vinculada a la agencia y con su rol, pero SIN
contraseña y SIN enviar ningún email. La primera entrada de esa persona puede
hacerse de dos formas:

- **Enlace mágico (recomendado):** la persona abre
  `https://TU-DOMINIO/login?agencia={slug}` e introduce su email en
  «Recibir enlace mágico por correo». Requiere que el email transaccional de
  Supabase esté operativo (por eso se recomienda SMTP propio en producción).
- **Contraseña:** desde Supabase Dashboard → **Authentication → Users**,
  selecciona al usuario y envíale la recuperación de contraseña
  («Send password recovery»); con el enlace que reciba fija su contraseña y
  entra con email + contraseña normales.

### 3. Activar su captación web

Con el usuario admin del cliente (o suplantándolo):

1. Ve a `/ajustes?tab=captacion`.
2. Activa **Formulario de contacto público**.
3. Copia el snippet iframe que genera la propia pantalla y pásalo a quien
   gestione la web del cliente (ver sección siguiente).

---

## Conexión con la web del cliente

Dos piezas conectan la web pública de la inmobiliaria con su CRM.

### Botón «Admin» hacia el CRM

En la web del cliente (por ejemplo en el pie de página o en una zona privada):

```html
<a href="https://TU-CRM.vercel.app/login?agencia={slug}">Admin</a>
```

El parámetro `?agencia=` preselecciona la agencia en el login: resuelve y
muestra su branding (nombre, logo, color) automáticamente y recuerda el slug
para próximas visitas, saltándose el paso de identificación. Sustituye
`{slug}` por el identificador real de la agencia (visible en `/maestro`, bajo
el nombre) y `TU-CRM.vercel.app` por tu dominio.

### Formulario público de captación embebible

Este es exactamente el snippet que genera la pestaña **Captación web** de
Ajustes (botón «Copiar código»):

```html
<iframe src="https://TU-CRM.vercel.app/form/{slug}" style="width:100%;height:640px;border:0;border-radius:12px"></iframe>
```

Notas:

- Solo funciona con la captación **activada** para esa agencia
  (`/ajustes?tab=captacion`); con la agencia desactivada o el formulario
  apagado, `/form/[slug]` muestra una página neutra de no disponible.
- Cada envío crea (o deduplica) un contacto en ESA agencia con origen «web» y
  consentimiento RGPD registrado, visible en `/contactos`.
- El aviso por email a los admins es best-effort: requiere `RESEND_API_KEY`;
  un fallo de email nunca impide guardar el lead.

---

## Verificación multi-agencia en producción

Checklist de aceptación del despliegue (Step 2 del brief). Marca cada punto
tras verificarlo con dos agencias reales o de prueba (A y B, creadas desde
`/maestro`):

- [ ] **Creación de agencia B de prueba** desde `/maestro` → Nueva agencia;
      aparece en la tabla con sus contadores a cero y estado Activa.
- [ ] **Sin fugas de datos por URL directa**: autenticado como usuario de A,
      abrir `/propiedades/{id-de-B}` (o un id inventado): no se muestran datos
      de B (las queries y las policies RLS `agency_isolation` filtran siempre
      por la agencia efectiva del usuario).
- [ ] **Listados aislados**: en `/propiedades`, `/contactos` y `/pipeline`,
      un usuario de A no ve ninguna fila de B; la timeline de actividades de
      un contacto de A no muestra registros creados desde B.
- [ ] **Formulario público dirigido**: un envío contra
      `/api/public/leads/{slug-de-A}` crea el contacto en A y en ninguna otra
      agencia; contra el slug de B, en B.
- [ ] **Banner de suplantación**: solo el super_admin ve el banner ámbar
      «Estás viendo {agencia} · Salir» mientras suplanta; los usuarios normales
      de la agencia no lo ven jamás, ni tampoco acceden a `/maestro`.
- [ ] **Agencia desactivada bloquea acceso**: desactiva B desde `/maestro`;
      el login de sus usuarios se bloquea con el mensaje «Esta agencia no está
      disponible o está desactivada», y su formulario público pasa a no
      disponible.
- [ ] **Auditoría**: tras suplantar y salir, existe registro en
      `impersonation_logs` con inicio y cierre (consulta en SQL Editor:
      `select * from impersonation_logs order by started_at desc limit 10;`).

---

## Gates de cierre (MVP) — superados 26-08-2026

- [x] **E2E PASS x2 consecutivas** — re-validado tras `aa4990c`: run1 32.4s/25.0s + run2 27.1s/24.4s `2 passed` (desktop 1440 + mobile 375). Runbook inline arriba; fuente original `.superpowers/sdd/task-19-report.md` §4 archivado.
- [x] **Pase visual responsive** 375/768/1440 — verificado: fotos Pexels, bottom-tab+FAB móvil, skeletons; fixes `39e853a`/`9800ff9`.
- [x] **Smoke endpoint público** — `POST https://crm-inmobiliario-phi-two.vercel.app/api/public/leads/{demo|inmobiliaria-sur}` 201, honeypot 200, 404 slug falso, `GET /form/[slug]` 200 (UnavailableView si inactive). Ejemplo:

  ```powershell
  Invoke-RestMethod -Method Post `
    -Uri "https://crm-inmobiliario-phi-two.vercel.app/api/public/leads/demo" `
    -ContentType "application/json" `
    -Body '{"fullName":"Prueba","phone":"600000000"}'
  ```
- [x] **Toasts y preview branding** — verificado en `/ajustes?tab=branding` y `/maestro` (preview vivo + toast).

---

## Solución de problemas

- **Warning del build sobre `middleware`**: Next 16 avisa de que la convención
  `middleware` está deprecada a favor de `proxy`. Es un aviso preexistente y
  esperado: no bloquea el build ni el despliegue. Migrable más adelante con el
  codemod oficial cuando se decida.
- **Error «No tienes ninguna agencia activa»**: le aparece a un super_admin
  SIN suplantación al intentar acciones propias de agencia (invitar usuarios,
  editar branding, etc.). Es correcto: un super_admin no pertenece a ninguna
  agencia. Solución: ve a `/maestro` y pulsa **Suplantar** en la agencia
  deseada; el banner ámbar indica el contexto activo y **Salir** lo cierra.
- **Invité a un usuario y no puede entrar con contraseña**: las cuentas
  invitadas se crean confirmadas pero sin contraseña. Usa el enlace mágico del
  login o envíale la recuperación de contraseña desde Supabase Dashboard
  (detalles en «Alta de una inmobiliaria cliente»).
- **El enlace mágico no llega o falla el callback**: comprueba que
  **Authentication → URL Configuration** tenga Site URL `https://TU-DOMINIO`
  y la Redirect URL `https://TU-DOMINIO/auth/callback`; en producción
  configura SMTP propio (límites del remitente compartido de Supabase).
- **Los avisos email de leads no llegan**: sin `RESEND_API_KEY` no hay envío
  (best-effort por diseño; el lead queda guardado). Con key, verifica el
  dominio remitente en Resend o define `LEADS_EMAIL_FROM` con un remitente
  permitido.
- **La migración falla en el bloque de Storage**: crea los buckets
  `property-images` y `branding` a mano (públicos) y reaplica solo la sección
  7 de `0001_schema.sql` (detalle en `crm/supabase/VERIFY.md`, paso A).
