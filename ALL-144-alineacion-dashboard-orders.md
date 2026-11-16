# ALL-144 — Alineación del Dashboard de Órdenes con la API disponible

- **Responsable:** Francisco Barriga
- **Presupuesto:** 1 punto (1 hora)
- **Rama de trabajo:** `fbarriga2024/all-144-sprint-final-s2-frontend-orders-alinear`
- **Base de revisión:** `develop` en `fb5fa8a` (rama actualizada con ALL-132 y adaptadores de Orders integrados).
- **Componentes y servicios auditados:**
  - `frontend-marketplace/src/app/ordenes/page.tsx`
  - `frontend-marketplace/src/components/shared/orders-dashboard-panel.tsx`
  - `frontend-marketplace/src/store/useOrdersStore.ts`
  - `frontend-marketplace/src/services/ordersQueryService.ts`
  - `frontend-marketplace/src/lib/mappers/orders.ts`
  - `frontend-marketplace/src/types/dto/orders.ts`
  - `backend-go/api/proto/orders.proto`
- **Fecha de ejecución:** 16-11-2026

---

## 1. Mapa de campos contrastado: `orders.proto` vs DTOs vs Store vs Dashboard

Se auditó la correspondencia de tipos y nombres entre el contrato gRPC (`orders.proto`), los DTOs de transporte REST y la representación visual en el Dashboard:

| Campo en `orders.proto` | Tipo Protobuf | DTO REST (`OrderDto`) | Mapper / Store | Visualización en Dashboard (`DashboardOrder`) |
| :--- | :--- | :--- | :--- | :--- |
| `id_orden` | `uint32` | `idOrden?: number` | `String(order.idOrden)` | `orderNumber: "Orden #" + id` |
| `id_usuario_comprador` | `uint32` | `idUsuarioComprador?: number` | Si rol es VENTA $\rightarrow$ `counterpartId` | `counterpartName: "Usuario #" + id` |
| `id_usuario_vendedor` | `uint32` | `idUsuarioVendedor?: number` | Si rol es COMPRA $\rightarrow$ `counterpartId` | `counterpartName: "Usuario #" + id` |
| `id_publicacion` | `uint32` | `idPublicacion?: number` | Mapeado sintético | `title: "Publicación #" + id` (la API de órdenes no incluye título) |
| `estado` | `EstadoOrden` (enum) | `estado?: EstadoOrdenDto` | Validado contra estados válidos y fallback a `ESTADO_ORDEN_UNSPECIFIED` | `status: PENDIENTE / ACEPTADA / COMPLETADA / CANCELADA / ESTADO_ORDEN_UNSPECIFIED` |
| `estado_str` | `string` | `estadoStr?: string` | Presente en contrato y DTO | No utilizado por el mapper |
| `precio` | `int64` | `precio?: string` | Valida string numérico sin convertir a Number | `price: string \| null` (tipo en UI declara `string \| number \| null`) |
| `created_at` | `Timestamp` | `createdAt?: string` (RFC 3339) | Conserva string de fecha | `createdAt: string` |
| `updated_at` | `Timestamp` | `updatedAt?: string` (RFC 3339) | Conservado en DTO | No se proyecta en la tarjeta simplificada |
| `meta.total_records` | `int64` | `totalRecords?: string` | Almacenado en `meta` del store | No consumido por los badges (usan `orders.length` de la página) |
| `meta.current_page` | `int32` | `currentPage?: number` | Almacenado en `meta` | Utilizado por el paginador del panel |
| `meta.total_pages` | `int32` | `totalPages?: number` | Almacenado en `meta` | Utilizado para deshabilitar botón "Siguiente" |
| `meta.limit` | `int32` | `limit?: number` | Almacenado en `meta` del store | No consumido por los controles del panel |

---

## 2. Distinción verificada: Lista vacía vs Consulta fallida

El flujo en `src/store/useOrdersStore.ts:39-90` y `orders-dashboard-panel.tsx` separa formalmente ambos escenarios:

### A. Lista vacía legítima (HTTP 200 con 0 registros)
- **Mecanismo:** La API responde con lista vacía (ejemplo ilustrativo de respuesta: `{ orders: [], meta: { totalRecords: "0", ... } }`).
- **Estado del store:** `status: 'success'`, `orders: []`, `error: null`.
- **Comportamiento en UI:**
  - El panel despliega el estado vacío en `orders-dashboard-panel.tsx:343`:
    *«No se encontraron órdenes en esta sección»*.
  - Subtexto contextual:
    - En Compras: *«Aún no has contratado servicios ni comprado artículos»* junto con el botón *«Explorar Catálogo de Servicios»*.
    - En Ventas: *«Aún no has recibido solicitudes ni realizado ventas»*.

### B. Consulta fallida (Error de red o error de servidor)
- **Mecanismo:** Ocurre un fallo de red o error HTTP 500/503.
- **Estado del store:** `status: 'error'`, `orders: []`, `error: 'No pudimos cargar las órdenes. Inténtalo nuevamente.'`.
- **Comportamiento en UI:** Se despliega un banner de error visual con botón de reintento (`loadPurchases` / `loadSales`).
- **Tratamiento diferenciado de HTTP 401 (Sesión inválida o expirada):**
  - El interceptor de Axios (`lib/axios.ts:28-45`) intercepta el 401, limpia la cookie `auth_token`, invoca `clearAuth()` y redirige al usuario a `/login?session=expired`.

---

## 3. Retiro de dependencias de `MOCK_ORDERS` en la ruta activa

- **Auditoría de importaciones:** Se verificó mediante búsqueda en todo el código fuente que `orders-dashboard-panel.tsx`, `useOrdersStore.ts` y `ordersQueryService.ts` **no importan ni consumen `MOCK_ORDERS`**.
- **Estado del fixture:** `MOCK_ORDERS` solo reside en `src/types/orders-dashboard.ts:45` con el comentario explícito: *«Fixtures sintéticos: el panel conectado no los importa»*. La interfaz está conectada 100% al store reactivo.

---

## 4. Punto de integración identificado para Semana 3

- **Ruta cliente:** `src/app/ordenes/page.tsx` $\rightarrow$ `OrdersDashboardPanel`.
- **Invocaciones HTTP:** Al montar la vista con sesión lista (`sessionReady`), se ejecutan concurrentemente con cancelación por `AbortController`:
  - `ordersQueryService.getPurchases()` $\rightarrow$ `GET ${ORDERS_API_URL}/v1/orders/mis-compras`.
  - `ordersQueryService.getSales()` $\rightarrow$ `GET ${ORDERS_API_URL}/v1/orders/mis-ventas`.
- **Requisitos para pruebas dinámicas en vivo (Semana 3):**
  - Servicio `cmd/orders` y PostgreSQL operativos (sea en clúster Kubernetes o en ejecución local con `go run cmd/orders/main.go`, configurando previamente `JWT_SECRET` y la conexión a BD exigidas en su arranque).
  - La variable `NEXT_PUBLIC_ORDERS_API_URL` configurada al gateway o endpoint del microservicio Orders.

---

## 5. Comprobaciones reproducibles locales (Ejecutadas en este entorno)

| Comprobación | Comando ejecutado | Resultado obtenido |
| :--- | :--- | :---: |
| **Suite Unitaria de Orders** | `node --test src/store/useOrdersStore.test.cjs src/store/useOrderActionsStore.test.cjs src/services/ordersMutationService.test.cjs` | **39/39 PASS** (670 ms) |
| **ESLint** | `npm run lint` | **Exit 0** (0 errores, 0 warnings) |
| **Compilación Turbopack** | `npm run build` | **Exit 0** (11 rutas generadas) |
