# ALL-131 · Revisión verificada del frontend antes de refactorizar

## 1. Alcance y estado de la revisión

Revisión de **solo lectura** de los flujos de registro/login, detalle de publicación y formulario de publicación. Se siguieron sus componentes, servicios HTTP, mappers y estado compartido. No se modificó código de la aplicación; las propuestas de cambios pertenecen a ALL-132. No se usaron `backend-microservices/` ni `Documentacion Sprint 0/`.

**Repositorio examinado el 11-11-2026:** rama `fbarriga2024/all-131-sprint-final-s1-refactor-frontend`; `HEAD` local `01797eebb50cee49ceba995561315b44b0fa1c3a` (commit documental previo). La base citada por el ticket es `b3dc9ad51c97bccc5bdb8aba8fc44d0449ff7bad`; `origin/develop` **local** apuntaba ya a `d67f075fad84a5d30ffab7f6c39f03381dc9e0c2`. `git merge-base HEAD origin/develop` dio `b3dc9ad…`. `git diff --name-only HEAD..origin/develop -- frontend-marketplace` no mostró diferencias de frontend en las referencias locales. **No se hizo `git fetch`**, por lo que no se afirma que el remoto en línea siga en ese commit.

`git status --short` mostró `?? output/mds/`: son documentos locales sin seguimiento; el árbol de trabajo **no está vacío**. El único archivo versionado que cambia entre la base `b3dc9ad` y este `HEAD` es el documento anterior `ALL-131-revision-frontend.md`; no hay un refactor de frontend en esa diferencia.

Las rutas y líneas de este informe se refieren a la rama y commit locales indicados. Una línea de código no equivale por sí misma a una prueba de integración funcionando en un servidor.

## 2. Inventario: responsabilidades, dependencias, entradas y efectos

### A. Registro y login

| Archivo y líneas | Qué recibe y quién lo llama | Qué hace, qué devuelve y qué efecto tiene |
| --- | --- | --- |
| `frontend-marketplace/src/app/login/page.tsx:8-20` | Ruta `/login`; pasa `sessionExpired` y `handleSuccess` a `LoginCard`. | Después de éxito redirige, tras 1200 ms, a `from` de la URL si existe o a `/`. La redirección **no** está implementada en `LoginForm`. |
| `frontend-marketplace/src/components/shared/login-card.tsx:13-25,123` | La página renderiza `LoginCard`; este renderiza `LoginForm` y le pasa un callback. | Propaga el éxito a la página. Solo si no hay callback propio redirige a `/`. |
| `frontend-marketplace/src/components/shared/login-form.tsx:20-72` | Submit con `email` y `password` del formulario. | Hace `POST /v1/auth/login` (43-46); toma `token` (48); llama `setAuthTokens(token)` (52), hace `GET /v1/auth/profile` (55), transforma el perfil con `mapProfileToUser` (58), guarda sesión con `setAuth` (61) y notifica éxito (62). Si falla, pone mensaje visible en `errorMessage` (63-70). |
| `frontend-marketplace/src/app/registro/page.tsx:28-29` y `src/components/shared/register-card.tsx:13-25,123` | La ruta `/registro` renderiza la tarjeta; la tarjeta renderiza `RegisterForm`. | Al recibir `onSuccess`, la tarjeta redirige a `/` tras 1500 ms si no se le pasó un callback externo. |
| `frontend-marketplace/src/components/shared/register-form.tsx:54-86` | Submit del formulario validado; los nombres de su **JSON** son `first_name`, `last_name`, `rut`, `phone`, `email` y `password` (58-65). | Hace `POST /v1/auth/register`, guarda el token con `setAuthTokens(token)` (70), pide `GET /v1/auth/profile` (73), mapea el perfil (76), guarda la sesión (78) y notifica éxito (79). Captura errores y muestra `errorMessage` (80-86). No envía `tipo_usuario`. |
| `frontend-marketplace/src/lib/authCookies.ts:3-21,23-34` | Recibe token de acceso; el parámetro de refresh es **opcional**. | Guarda la cookie `auth_token`; también conoce funciones para leerla y retirar tokens. Ambos formularios llaman con **un solo argumento**, el token de acceso. |
| `frontend-marketplace/src/lib/axios.ts:5-49` | Solicitudes de los formularios a través de `api`/`apiClient`. | Define URL base; si hay cookie, añade `Authorization: Bearer` (16-24). Ante HTTP 401, limpia cookies y estado de sesión y redirige a `/login?session=expired` si no está ya en login (28-45). |
| `frontend-marketplace/src/lib/mappers/auth.ts:20-34` y `src/store/useAuthStore.ts:18-58` | Perfil recibido de IAM; los formularios llaman al mapper y `setAuth`. | Convierte campos del perfil al usuario de UI; Zustand guarda `user`, `token`, autenticación y carga con `persist` en la clave `auth-storage` de `localStorage`. `clearAuth`, `setLoading` y `updateUser` son las otras operaciones reales. |

**Consulta adicional para comprobar consumidores:** búsqueda en `frontend-marketplace/src` de `loginUser`, `registerUser`, `getPublicProfile`, `mapProfileToUser` y `setIsLoadingCategories`. `loginUser` y `registerUser` aparecen únicamente en sus declaraciones de `src/services/authService.ts:6-39` dentro del código fuente; los formularios **no** los llaman. En cambio, `getPublicProfile` (`authService.ts:54-75`) sí se importa y usa en `src/app/perfil/[id]/page.tsx:14,95` para consultar `GET /v1/auth/profile/${userId}`. Conservar esa exportación. No se evaluaron consumidores fuera del repositorio.

### B. Detalle y contratación

| Archivo y líneas | Entrada y dependencias | Salida, estados y efectos |
| --- | --- | --- |
| `frontend-marketplace/src/app/publicaciones/[id]/page.tsx:18-70` | Toma `id` de la URL (24-27), llama `publicationService.getPublicationById(id, signal)` (44). | Estado `loading`, `success`, `not-found` o `error` (18-22); HTTP 404 conduce a `not-found` (54-56), otros errores a `error` (59). `AbortController` cancela la solicitud al desmontar/cambiar id (39-66); `retry` repite la consulta (68-70). |
| `frontend-marketplace/src/services/publicationService.ts:98-134` | `id: string` y señal opcional; llama `axios.get` directamente a `${CATALOG_API_URL}/v1/publications/${encodeURIComponent(id)}` (98-102). | Mapea JSON a `CatalogPublication`, o lanza error si falta `publication` (104-107). Es una consulta pública; no usa la instancia `api` en este método. |
| `frontend-marketplace/src/app/publicaciones/[id]/page.tsx:73-165` | Valida sesión, token, ids, que el comprador no sea el vendedor, precio y que la publicación no sea `DEMANDA` (73-103). | Abre modal cuando corresponde (106-110). Usa `purchaseLock` para impedir doble envío simultáneo (117-127) y llama `orderService.createOrder` con `idUsuarioVendedor`, `idPublicacion` y `precio` (130-134), **sin `cantidad`**. Exige un `idOrden` válido (136-139) y maneja errores HTTP 401/403/409/400 (143-160). |
| `frontend-marketplace/src/components/shared/purchase-confirmation-modal.tsx:93-101` y `src/services/orderService.ts:8-30` | El modal invoca `onConfirm` y evita reenvíos mientras envía. `orderService` recibe el DTO de crear orden. | El servicio valida ids/precio, envía `POST ${ORDERS_API_URL}/v1/orders` con `api` (23) y exige un id de orden en la respuesta (25-30). Esto prueba una **llamada HTTP en el código**, no que Orders esté disponible en todos los entornos. |

### C. Formulario de publicación

| Archivo y líneas | Entrada y dependencias | Salida y efectos |
| --- | --- | --- |
| `frontend-marketplace/src/app/publicar/page.tsx:15-50` | Estado de formulario, categorías, envío, errores y usuario del store. Al montar llama `publicationService.getCategories()` (33-46). | Cambia `categories` si la respuesta llega. Existe `setIsLoadingCategories`, pero el valor del estado se descarta (`const [, setter]`); ningún render lo lee (19,41). |
| `frontend-marketplace/src/app/publicar/page.tsx:52-116` | `handleSubmit` valida sesión, campos, título mínimo 5, descripción 50–1000 y precio positivo (56-93). Pasa título, descripción, categoría, precio, moneda, tipo, vendedor y ubicación al servicio (98-107). | Si la promesa se resuelve, muestra `alert()` de éxito y redirige a `/` (108-109); ante excepción, `alert()` de error (110-114). `isSubmitting` se restablece en `finally` (115-116). |
| `frontend-marketplace/src/services/publicationService.ts:139-159,265-323` | `getCategories()` consulta `/v1/categories` y retorna `[]` al fallar. `createPublication` recibe `Omit<CatalogPublication, 'id' | 'createdAtRelative'>`; construye JSON con vendedor, categoría, título, descripción, tipo, precio, ciudad y región (273-282). | Usa `api.post` a `/v1/publications` (284-287), mapea la respuesta a `CatalogPublication` (295-322) o devuelve `null` si no viene `publication` (289-293). El formulario **no comprueba ese `null`** antes del aviso de éxito. |

## 3. Hallazgos y consumidores comprobados

1. **Estado no leído (candidato pequeño y seguro):** `publicar/page.tsx:19,41` crea y cambia `isLoadingCategories`, pero nunca lee el valor; la lista de categorías sí está en `categories` y **debe preservarse**. Eliminar solo ese estado y su setter evita trabajo interno sin cambiar las peticiones ni el render.
2. **Duplicación parcial de inicio de sesión:** login y registro repiten guardar token → GET perfil → mapear → `setAuth` (`login-form.tsx:48-62`, `register-form.tsx:67-79`). Hay diferencias reales: login marca `submitSuccess` y su tarjeta permite volver a `from`; registro usa otro tiempo de redirección. Una extracción futura requeriría preservar estas diferencias, por eso **no se recomienda automáticamente unificar los formularios**.
3. **Exportaciones sin consumidores en el código fuente:** `authService.ts:6-39` define `loginUser` y `registerUser`, mientras los formularios llaman `api.post` directamente. La búsqueda en `frontend-marketplace/src` halló solo esas definiciones. Su posible eliminación exige comprobar antes imports indirectos, pruebas u otros consumidores externos: son exportaciones, así que **no se declara eliminación segura solo por una búsqueda**.
4. **Función con consumidor activo:** `getPublicProfile` sí se usa en `perfil/[id]/page.tsx:95`; se preserva junto con su ruta `/v1/auth/profile/${userId}`.

## 4. Alcance acotado recomendado para ALL-132

**Primer cambio propuesto:** retirar únicamente el estado no leído `setIsLoadingCategories` y la llamada al setter de `frontend-marketplace/src/app/publicar/page.tsx:19,41`. La carga de categorías, `setCategories(data)`, los mensajes, las solicitudes y la navegación deben permanecer iguales. Antes de cambiar, comprobar el mismo flujo con categorías y con fallo de carga; después, repetirlo y contrastar UI y peticiones. Este documento **no implementa** el cambio.

**Solo si queda capacidad y se comprueban todos sus consumidores:** decidir qué hacer con los wrappers `loginUser`/`registerUser`; no eliminarlos ni reconectar formularios como consecuencia automática de este inventario. Mantener contratos, campos públicos, reglas, sesión, `alert()` y redirecciones actuales. Ninguna funcionalidad o endpoint nuevos.

| Caso observable | Antes, según implementación actual | Lo que se debe verificar después del refactor |
| --- | --- | --- |
| Publicar, caso válido | Se valida, se solicita crear, aparece `alert()` y se navega a `/` (`publicar/page.tsx:52-109`). | Misma solicitud, mismo aviso, mismo destino y mismas reglas. |
| Publicar, error HTTP | Se ejecuta `catch` y aparece `alert()` de error (`publicar/page.tsx:110-116`). | Mismo tratamiento y mensaje para la misma respuesta de error. |
| Categorías, éxito y fallo | Se solicitan al montar (33-46); `getCategories` retorna lista o `[]` (servicio 139-159). | Misma consulta y contenido visible, aun retirando el estado no leído. |
| Registro/login, éxito/error | El formulario crea sesión y notifica la tarjeta; cada página/tarjeta determina navegación; errores se muestran en el formulario. | Sin cambios si no se tocan estos flujos; si se amplía el refactor, comparar cookies, store, redirección, mensajes y petición de perfil. |

## 5. Defectos o integraciones pendientes: fuera del refactor de esta semana

- `publicar/page.tsx:98-109` muestra éxito aun cuando `createPublication` devuelva `null` (`publicationService.ts:289-293`). Arreglar ese caso cambia el comportamiento observable; registrarlo como defecto separado.
- `login/page.tsx:11` espera `expired=true`, mientras `lib/axios.ts:42` redirige con `session=expired` ante HTTP 401. Corregir el aviso de sesión expirada es una mejora funcional aparte.
- `publicationService.ts:139-159` convierte fallos de categorías en lista vacía; `publicar/page.tsx:38-41` solo ve `[]` y no diferencia error de lista vacía. Mostrar un estado de error requeriría cambio visible.
- El perfil público consume datos reales pero aún contiene perfiles/reseñas de respaldo (`perfil/[id]/page.tsx:18-21,63,95,163-165`). La retirada de mocks corresponde a trabajo posterior.
- `orderService.ts:6,23` señala una URL local para Orders y realiza una petición; esta revisión no comprobó que exista un servicio Orders operativo en cada entorno. No afirmar disponibilidad de backend por el solo código frontend.

## 6. Comprobaciones y evidencia de entrega

| Comprobación realizada en esta rama | Resultado local |
| --- | --- |
| `npm run lint` desde `frontend-marketplace/` | **Exit 0**; ESLint no mostró diagnósticos. |
| `npx tsc --noEmit --incremental false` desde `frontend-marketplace/` | **Exit 0**; comprobación de tipos sin emisión. |
| `npm run build` desde `frontend-marketplace/` | **Exit 0 en máquina local:** Turbopack compiló exitosamente en 8.6s y generó 11 rutas estáticas/dinámicas (con aviso informativo deprecation de middleware a proxy). En entornos con límites de procesos en sandbox puede requerir repetir la ejecución. |
| Búsqueda de referencias en `frontend-marketplace/src` | `getPublicProfile` tiene consumidor; `loginUser`/`registerUser` no aparecen llamados; `setIsLoadingCategories` se escribe pero no se lee. |
| Diff contra la base de revisión `b3dc9ad..HEAD` | Solo el documento anterior de ALL-131 estaba versionado como cambio; no se ejecutó un refactor de código frontend. |

**Evidencia que todavía falta para cerrar ALL-131:** enlazar el commit que contenga **esta versión corregida**, añadir la URL de un **PR realmente creado** (un enlace `/pull/new/...` solo abre un formulario), y agregar en el ticket el resultado o la limitación reproducible del build y los archivos revisados. Si solo se revisó y no se cambió código, indicarlo expresamente; no declarar una comparación real *después* de un refactor todavía no implementado. La descripción de ALL-131 exige evidencia antes de marcarla terminada. Estado consultado: `In Review`; sus criterios en la descripción se documentan verificados con esta entrega.

**Límite de la evidencia:** análisis estático y comprobaciones locales. No se ejecutaron flujos reales en navegador ni se comprobó un backend desplegado; las comparaciones de interfaz anteriores/después son un **plan** para ALL-132.
