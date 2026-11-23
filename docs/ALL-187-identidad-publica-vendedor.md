# ALL-187 — Alinear identidad pública del vendedor con publicación y perfil (Vendedor MVP)

- **Responsable:** Nicolás Fuentes (`@JanoRules`)
- **Presupuesto:** 2 puntos (2 horas). Límite de planificación, no acredita tiempo ejecutado.
- **Rama de trabajo:** `feat/ALL-187-vendedor-identidad-publica`
- **Base de comparación:** `develop` en `38f6a0c` (la replanificación consultó `9f81985`). Estado de ALL-139 y ALL-142: no verificado; ALL-152 aparece fusionada en develop (PR #360); su estado en Linear no se verificó; incluye PR #362 (ALL-151), PR #360 (ALL-152), PR #359 (ALL-155), PR #357 (ALL-182), PR #355 (ALL-154) y PR #354 (ALL-153).
- **Fecha de ejecución:** 23-11-2026
- **Revisión cruzada:** pendiente de asignar. Francisco es el consumidor en ALL-188.

**Entorno y versiones verificadas en terminal:**
- **Runtime:** Go `go1.27.1 windows/amd64`; Node.js `v22.18.0`; Next.js `16.3.3` (Turbopack)
- **Base de datos:** `PostgreSQL 16.15 on x86_64-pc-linux-musl` (contenedor Docker `postgres_catalog`, puerto `5434`, base `catalog_db`)
- **Declaración de infraestructura local:** Para esta verificación local, tanto el ejecutable de `IAM` como el de `Catalog` compartieron la misma base física (`catalog_db` en el contenedor `postgres_catalog`). No se levantó una base independiente `iam_db`.
- **Configuración de entorno frontend:** `.env.example` apunta `NEXT_PUBLIC_API_URL` a `http://localhost:8080` (gateway). Al correr IAM directo en `:8081`, el navegador mostró Network Error y el detalle degradó a "Usuario #id". Se resolvió con un `.env.local`, ignorado por Git, con `NEXT_PUBLIC_API_URL=http://localhost:8081`. Quien repita la prueba debe crearlo.
- **Microservicios ejecutados localmente:**
  - `IAM` (`go run ./cmd/iam/main.go`): gRPC `:50051` / REST Gateway `:8081`
  - `Catalog` (`go run ./cmd/catalog/main.go`): gRPC `:50052` / REST Gateway `:8082`

---

## 1. Decisión de Diseño y Archivos Afectados

Se adoptó la **Opción A (resolución en frontend contra el contrato público existente de IAM)**, sin modificar archivos `.proto`, servicios Go, `docker-compose.yml` ni manifiestos Kubernetes, y sin tocar `frontend-marketplace/src/app/perfil/[id]/page.tsx` (ámbito exclusivo de Francisco en `ALL-188`).

**Archivos modificados (5 contando este documento):**
- `frontend-marketplace/src/services/authService.ts`:
  - Se añadió parámetro opcional de cancelación `signal?: AbortSignal` en `getPublicProfile(userId, signal)`.
  - Como decisión de diseño, se configuró `timeout: 3000` en la petición Axios para evitar bloqueos si IAM experimenta latencia o caída no detectada a nivel de socket (no se probó con un IAM lento).
  - Ante cancelación (`axios.isCancel` o `signal.aborted`) o error HTTP (`404` / IAM caído / timeout), retorna `null` de forma controlada sin lanzar excepciones ni inventar `"Usuario"` cuando los nombres vienen vacíos.
  - Cambios de comportamiento que Francisco debe conocer (ya que `/perfil/[id]` usa `getPublicProfile`): nombre y apellido vacíos ya no se reemplazan por `"Usuario"`, y un `userId` no numérico devuelve `null`.
- `frontend-marketplace/src/app/publicaciones/[id]/page.tsx`:
  - Como decisión de diseño para mitigar latencia de IAM y desacoplar la carga, renderiza la publicación de inmediato con `sellerName: undefined` (no se probó con un IAM lento).
  - Consulta asíncrona de identidad: Llama a `getPublicProfile(publication.sellerId, controller.signal)` y actualiza reactivamente `sellerName` únicamente si `profile !== null`, `profile.userId === publication.sellerId` y el nombre completo (`firstName + lastName`) no está vacío.
  - Ante `null`, error o discrepancia de ID, deja `sellerName` en `undefined` para conservar el `sellerId` real (`Usuario #<sellerId>` y enlace `/perfil/<sellerId>`) sin arrastrar datos del vendedor anterior.
- `frontend-marketplace/src/services/authService.test.mjs`: 5 pruebas nuevas para `getPublicProfile` (`AbortSignal`, aislamiento entre dos vendedores distintos, exclusión de `email` y `telefono`, cancelación y `404` / nombres vacíos).
- `frontend-marketplace/tests/purchase-flow.test.mjs`: Se agregó un mock de `authService` en la preparación común y las 2 esperas `Promise.resolve` pasaron a 10 vueltas porque el flujo ahora tiene más pasos asíncronos. Se incorporaron 4 pruebas nuevas para el detalle de publicación (resolución de nombre real y enlace `/perfil/{id}`, degradación segura ante `404`/fallo de IAM, rechazo de `userId` no coincidente y aislamiento entre dos publicaciones de vendedores distintos).
- `docs/ALL-187-identidad-publica-vendedor.md`: Documento de registro y evidencia técnica.

---

## 2. Pruebas Automatizadas y Build (`frontend-marketplace`)

Ejecutadas desde `frontend-marketplace/`:

- **Suite unitaria (`node --test src/services/authService.test.mjs tests/purchase-flow.test.mjs`):**
  - **30 ejecutadas, 29 aprobadas, 1 fallida, 0 omitidas.**
  - Pruebas ejecutadas con dependencias simuladas, sin navegador.
  - La prueba fallida es "navegar durante una confirmación mantiene aislados publicación y resultado" (`tests/purchase-flow.test.mjs`). También falla en develop 38f6a0c sin ningún cambio de esta tarea (11 de 12 pruebas pasan en ese archivo). Es un defecto previo y ajeno a ALL-187: no se corrigió, queda registrado para un seguimiento. No se afirma cuál es su causa.
- **Linter (`npm run lint`):** Sin errores ni advertencias.
- **Compilación de producción (`npm run build`):** Correcto; la lista de rutas tiene 12 entradas.

---

## 3. Verificación Real con IAM + Catálogo + PostgreSQL (Sin Mocks)

### 3.1. Corrida por API (usuarios 1 y 2, publicaciones 515 y 516)

1. **Registro de Vendedor A (`POST http://localhost:8081/v1/auth/register`):**
   - **Esperado:** `HTTP 200` y creación de usuario real en PostgreSQL.
   - **Observado en API:** `HTTP 200`, `userId: "1"` (`Camila Rojas`).
2. **Registro de Vendedor B (`POST http://localhost:8081/v1/auth/register`):**
   - **Esperado:** `HTTP 200` y creación de segundo usuario real distinto.
   - **Observado en API:** `HTTP 200`, `userId: "2"` (`Diego Munoz`).
3. **Publicaciones en Catálogo y contraste con perfil público de IAM:**
   - **Publicación A (`GET http://localhost:8082/v1/publications/515`):** `HTTP 200`, `idUsuarioVendedor: 1`, `vendedor.idUsuario: 1`, `email: ""`, `telefono: ""`.
   - **Perfil público IAM A (`GET http://localhost:8081/v1/auth/profile/1`):** `HTTP 200`, `{"userId":"1","firstName":"Camila","lastName":"Rojas","bioExperiencia":"","habilidades":"","ciudad":"","region":"","fotoPerfilUrl":"https://res.cloudinary.com/rstk3bky/image/upload/avatars/default-avatar.png","portadaUrl":"","rol":"CLIENTE"}`. Comprobado que no expone `email`, `telefono`, `rut` ni credenciales.
   - **Publicación B (`GET http://localhost:8082/v1/publications/516`):** `HTTP 200`, `idUsuarioVendedor: 2`, `vendedor.idUsuario: 2`, `email: ""`, `telefono: ""`.
   - **Perfil público IAM B (`GET http://localhost:8081/v1/auth/profile/2`):** `HTTP 200`, `{"userId":"2","firstName":"Diego","lastName":"Munoz","bioExperiencia":"","habilidades":"","ciudad":"","region":"","fotoPerfilUrl":"https://res.cloudinary.com/rstk3bky/image/upload/avatars/default-avatar.png","portadaUrl":"","rol":"CLIENTE"}`. Comprobado que no expone `email`, `telefono`, `rut` ni credenciales.
4. **Ausencia de perfil y caída de IAM en API:**
   - **Ausencia de perfil en IAM:** 404 observado por API con el ID 999999 (inexistente); el caso del vendedor 991 en navegador queda pendiente.
   - **IAM detenido (`Ctrl + C` en terminal de IAM, Catálogo activo en `:8082`):** `GET http://localhost:8082/v1/publications/515` respondió `HTTP 200`, conservando `idUsuarioVendedor: 1`. La petición a IAM (`GET http://localhost:8081/v1/auth/profile/1`) dio fallo de conexión (`HTTP 000`).
5. **Limpieza de datos de la corrida por API:**
   - Se ejecutó limpieza en contenedor `postgres_catalog`:
     ```sql
     DELETE FROM publicaciones WHERE id_publicacion IN (515, 516);
     DELETE FROM usuarios WHERE id_usuario IN (1, 2);
     ```
   - Estado verificado post-limpieza: 50 publicaciones base y 0 usuarios residuales de prueba.

### 3.2. Corrida en navegador (usuarios 3 y 4, publicaciones 517 y 518)

1. **Camino feliz en navegador:**
   - En `/publicaciones/517` se mostró `Camila Rojas` y en `/publicaciones/518` se mostró `Diego Munoz`, sin mezcla de identidades.
   - El enlace "Ver Perfil Público del Usuario" llevó respectivamente a `/perfil/3` y `/perfil/4` con el nombre correcto.
   - Las capturas de 517 y 518 se realizaron en pestañas separadas. Esto prueba que cada publicación muestra su vendedor, pero no que navegar de una a otra en la misma pestaña no arrastre datos. Ese aislamiento solo está respaldado por `key={id}` en el código y por una prueba simulada.
2. **IAM detenido en navegador:**
   - En `/publicaciones/517` con IAM apagado, la publicación cargó y el vendedor quedó mostrado como `Usuario #3`.
3. **Limpieza de datos de la corrida en navegador:**
   - Usuarios 3 y 4 y publicaciones 517 y 518 eliminados de catalog_db (DELETE 2 en publicaciones, DELETE 2 en usuarios); verificado total_publicaciones = 50 y total_usuarios = 0.

---

## 4. Coordinación Técnica para Francisco (`ALL-188` — `/perfil/[id]`)

- **Contrato público disponible en `src/services/authService.ts`:**
  - `getPublicProfile(userId: number, signal?: AbortSignal): Promise<PublicProfileData | null>`
  - Retorna `{ userId, firstName, lastName, bioExperiencia, habilidades, ciudad, region, fotoPerfilUrl, portadaUrl, rol }` o `null` si el usuario no existe (`404`), la petición se cancela o IAM no responde (timeout 3000 ms, no probado con IAM lento). Nunca incluye `email` ni `telefono`.
- **Cambios de comportamiento en `authService.ts` que Francisco debe conocer (ya que `/perfil/[id]` usa `getPublicProfile`):**
  - Nombre y apellido vacíos ya no se reemplazan por `"Usuario"`.
  - Un `userId` no numérico devuelve `null`.
- **Hallazgos observados en `/perfil/[id]` para Francisco:**
  - En `/perfil/3` y `/perfil/4` se muestran el nombre real y la publicación activa correcta, pero biografía, ubicación, "Miembro desde", reputación, reseñas e insignia "Identidad Verificada" no vienen de IAM (IAM devolvió bio, ciudad y región vacías).
- **Trabajo pendiente en `frontend-marketplace/src/app/perfil/[id]/page.tsx` (según lectura de código, a confirmar por Francisco):**
  - Eliminar el arreglo `MOCK_SELLERS` y `DEFAULT_SELLER` (`Juan Andrés Pérez Silva`), así como `MOCK_SELLER_REVIEWS`.
  - Evitar el merge con `...prev` sobre datos simulados cuando `getPublicProfile(numericId)` resuelve.
  - Reiniciar el estado del perfil al cambiar `numericId` (o montar con `key={id}`) y mostrar una vista explícita de "Perfil no encontrado" cuando `getPublicProfile` devuelva `null`.

---

## 5. Criterios de Aceptación y Limitaciones

- **Criterio 1: El vendedor del detalle y el destino del enlace pertenecen al ID de la publicación:** Observado en navegador (nombre y enlace correctos).
- **Criterio 2: Un fallo/ausencia de perfil no inventa una identidad ni conserva datos del vendedor anterior:** Cumplido en el detalle cuando se accede de forma aislada; que navegar de una publicación a otra en la misma pestaña no arrastre datos solo está respaldado por `key={id}` en el código y por una prueba simulada. En el destino del enlace la identidad real convive con datos inventados hasta que se cierre ALL-188, no se declara cumplido de punta a punta.
- **Criterio 3: Los campos expuestos tienen respaldo en IAM y el tratamiento de error se verifica con el consumidor:** Pendiente con Francisco.

**Limitaciones conocidas:**
- **Entorno de base de datos:** En este ensayo local, IAM y Catálogo compartieron la base de datos `catalog_db` en el mismo contenedor Docker `postgres_catalog`.
- **Origen de datos de ubicación en Catálogo:** `ciudad` y `region` del bloque vendedor de Catálogo salen de la publicación (`catalog_db`), no de IAM.
- **Métricas no implementadas:** Catálogo devuelve `0` numérico en `calificacionPromedio`, `totalResenas` y `trabajosCompletados` en el payload protobuf de `SellerSummary`. Estos campos no tienen respaldo en IAM y el frontend de publicación no los consume.
- **Comprobación de identidad en cliente:** En `getPublicProfile`, si IAM no devolviera `userId`, el código usa el ID solicitado y la comprobación de coincidencia no discriminaría. En todas las pruebas realizadas IAM sí lo devolvió.
- **Suite de pruebas:** La suite no queda en verde por la prueba preexistente indicada en la sección 2 ("navegar durante una confirmación mantiene aislados publicación y resultado" en `tests/purchase-flow.test.mjs`, que también falla en develop 38f6a0c).
- **Pruebas de diseño pendientes:** El timeout de 3000 ms y el renderizado en dos tiempos no se probaron con un IAM lento.
- **Captura pendiente en navegador:** 404 observado por API con el ID 999999 (inexistente); el caso del vendedor 991 en navegador queda pendiente.
