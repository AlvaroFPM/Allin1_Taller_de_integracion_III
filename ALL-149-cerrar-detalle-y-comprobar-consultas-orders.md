# ALL-149 — [Sprint final S3] [Orders MVP] Cerrar detalle autorizado y comprobar compras y ventas

- **Responsable:** Álvaro Felipe Pinilla Martínez (`@AlvaroFPM`)
- **Revisor / Consumidor Frontend:** Francisco Barriga (`@fbarriga2024`)
- **Presupuesto de planificación:** 2 puntos (2 horas)
- **Rama de trabajo:** `feat/ALL-149-orders-detalle-y-consultas`
- **Línea base contrastada:** `develop` en `9f81985` (`Merge pull request #348 from AlvaroFPM/ALL-183-media-cliente-multipart`, verificado con `git fetch origin`; sin cambios posteriores pendientes).
- **Fecha de ejecución:** 21-11-2026
- **Versión y entorno verificados:**
  - Go: `go version go1.27.1 windows/amd64`
  - Base de datos real: `PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit` (contenedor Docker `postgres_orders`, puerto `5437`, base `orders_db`)
  - Consumidor contrastado: `frontend-marketplace` (Node test runner + TypeScript DTOs/mappers/stores)

---

## 1. Objetivo y Comprobación de Base Previa

Cerrar la operación `GetOrder` prevista en el contrato `orders.proto` cargando la orden persistida en PostgreSQL y restringiendo el acceso exclusivamente a comprador o vendedor, y comprobar `ListMyPurchases`, `ListMySales` y `PaginationMeta` existentes junto con el mapeo hacia el consumidor frontend.

### Verificación de integraciones previas (reutilizadas sin reescritura)
- **ALL-137** (`cmd/orders/main.go`, `internal/api/orders/router.go`): servidor gRPC con `middleware.UnaryAuthInterceptor()`, gateway REST en `:8084` y CORS habilitados; falla de arranque visible sin `JWT_SECRET` o BD.
- **ALL-138 y ALL-141** (`CreateOrder` en `order_service.go` y `order_service_server.go`): identidad del comprador tomada exclusivamente del JWT (`extractUserID(ctx)`), salvaguarda `ORDERS_ENABLE_CREATION` y validación cruzada de publicación, vendedor y precio con Catálogo (`PublicationGetter`).
- **ALL-179** (`order_service_server.go`, `router_test.go`): verificación en compilación `var _ orderspb.OrderServiceServer = (*OrderServiceServer)(nil)`, equivalencia de rutas `/v1/orders` y alias `/v1/ordenes`, y serialización `protojson`.
- **ALL-140** (`jwt_interceptor.go`, `iam_identity_integration_test.go`): validación estricta del claim numérico `user_id > 0` y rechazo de tokens inválidos/expirados/malformados.
- **Reutilización:** `ListMyPurchases`, `ListMySales`, `listOrdersByUser`, `normalizePagination`, `validateOrderFilterState`, `buildListOrdersResponse`, `PaginationMeta` y `ModelToProtoOrder` se conservaron intactos sin reescribirse. Tampoco se modificó `orders.proto` ni los artefactos generados (`orders.pb.go`, `orders.pb.gw.go`, `orders_grpc.pb.go`, `orders.swagger.json`).

---

## 2. Archivos Afectados

| Archivo | Cambio realizado |
| :--- | :--- |
| [order_service.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service.go) | Implementación de `OrderService.GetOrder(ctx, ordenID, usuarioID)` y helper puro `validateOrderReadAccess(orden, usuarioID)`. |
| [order_service_server.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_server.go) | Reemplazo del stub `Unimplemented` de `GetOrder` por validación de `req`/`extractUserID(ctx)`, delegación a `orderService.GetOrder` y mapeo mediante `ModelToProtoOrder`. |
| [order_service_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_test.go) | Pruebas puras (`TestValidateOrderReadAccess_PureValidation`, `TestGetOrder_InputValidations_Pure`) y prueba en PostgreSQL real (`TestGetOrder_DBIntegration`). |
| [order_service_server_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_server_test.go) | Validaciones del adaptador (`TestOrderServiceServer_GetOrder_Validations`) y pruebas sobre PostgreSQL real (`TestOrderServiceServer_GetOrder_DBIntegration`, `TestOrderServiceServer_ListOrders_DBIntegration`). |
| [router_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/api/orders/router_test.go) | Cobertura de 401 en rutas nuevas, validación de IDs inválidos en `GET /v1/orders/{id}` y alias `/v1/ordenes/{id}`, pruebas `protojson` para `GetOrderResponse` y lista vacía, y suite integral HTTP + gRPC nativo sobre PostgreSQL real (`TestHTTPGateway_OrdersQueries_DBIntegration`). |
| [ALL-149-cerrar-detalle-y-comprobar-consultas-orders.md](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/ALL-149-cerrar-detalle-y-comprobar-consultas-orders.md) | Evidencia reproducible y ejemplos sanitizados de lista y detalle para consumo frontend. |

---

## 3. Comportamiento Implementado en `GetOrder`

1. **Autenticación:** extrae `usuarioID := extractUserID(ctx)` inyectado por `middleware.UnaryAuthInterceptor()`. Si falta o es `0`, retorna `codes.Unauthenticated` (HTTP `401`).
2. **Validación de identificador:** si la petición es `nil`, `id_orden == 0` o el path parameter no es un entero positivo válido (`abc`, `-1`), gRPC-Gateway / dominio retornan `codes.InvalidArgument` (HTTP `400`).
3. **Carga persistida en PostgreSQL:** `s.db.WithContext(ctx).First(&orden, ordenID)` consulta la tabla `ordenes` filtrando automáticamente registros con `deleted_at IS NOT NULL`. Si no existe o fue eliminada lógicamente, retorna `codes.NotFound` (HTTP `404`). Si `s.db == nil`, retorna `codes.Unavailable` (HTTP `503`).
4. **Autorización por participante:** `validateOrderReadAccess` verifica `orden.IDUsuarioComprador == usuarioID || orden.IDUsuarioVendedor == usuarioID`. Cualquier cuenta ajena recibe `codes.PermissionDenied` (HTTP `403`) sin exponer datos de la orden.
5. **Mapeo de respuesta:** retorna `orderspb.GetOrderResponse{Order: ModelToProtoOrder(orden)}`, preservando `precio` (`int64`), enum `estado`, `estado_str` y timestamps `created_at` / `updated_at`.

---

## 4. Contraste de Contrato y Mapeo con el Consumidor (`frontend-marketplace`)

Se contrastó la respuesta JSON real emitida por gRPC-Gateway contra [orders.ts](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/frontend-marketplace/src/types/dto/orders.ts), [orders.ts (mapper)](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/frontend-marketplace/src/lib/mappers/orders.ts), [ordersQueryService.ts](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/frontend-marketplace/src/services/ordersQueryService.ts) y [useOrdersStore.ts](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/frontend-marketplace/src/store/useOrdersStore.ts):

| Campo `orders.proto` | Tipo Protobuf | JSON real (gRPC-Gateway) | Consumidor `frontend-marketplace` | Estado |
| :--- | :--- | :--- | :--- | :---: |
| `id_orden` | `uint32` | `idOrden`: `number` | `OrderDto.idOrden?: number` / `Number.isInteger(order.idOrden)` | Compatible |
| `id_usuario_comprador` | `uint32` | `idUsuarioComprador`: `number` | `OrderDto.idUsuarioComprador?: number` (contraparte en `VENTA`) | Compatible |
| `id_usuario_vendedor` | `uint32` | `idUsuarioVendedor`: `number` | `OrderDto.idUsuarioVendedor?: number` (contraparte en `COMPRA`) | Compatible |
| `id_publicacion` | `uint32` | `idPublicacion`: `number` | `OrderDto.idPublicacion?: number` (`Publicación #${id}`) | Compatible |
| `estado` | `EstadoOrden` | `estado`: `"PENDIENTE" \| "ACEPTADA" \| "COMPLETADA" \| "CANCELADA"` | `OrderDto.estado?: EstadoOrdenDto` | Compatible |
| `estado_str` | `string` | `estadoStr`: `string` | `OrderDto.estadoStr?: string` | Compatible |
| `precio` | `int64` | `precio`: `string` (ej. `"9007199254740993"`) | `OrderDto.precio?: string` (validado con `/^-?\d+$/` sin perder precisión) | Compatible |
| `created_at` | `Timestamp` | `createdAt`: `string` RFC 3339 UTC | `OrderDto.createdAt?: string` | Compatible |
| `updated_at` | `Timestamp` | `updatedAt`: `string` RFC 3339 UTC | `OrderDto.updatedAt?: string` | Compatible |
| `meta.total_records` | `int64` | `totalRecords`: `string` (ej. `"2"`, `"0"`) | `OrdersPaginationMetaDto.totalRecords?: string` | Compatible |
| `meta.current_page` | `int32` | `currentPage`: `number` | `OrdersPaginationMetaDto.currentPage?: number` | Compatible |
| `meta.total_pages` | `int32` | `totalPages`: `number` (`0` si vacío) | `OrdersPaginationMetaDto.totalPages?: number` (`totalPages > 0`) | Compatible |
| `meta.limit` | `int32` | `limit`: `number` | `OrdersPaginationMetaDto.limit?: number` | Compatible |

### Notas relevantes para el consumidor (Francisco)
- En respuestas reales de HTTP Gateway (`runtime.NewServeMux()`), cuando no hay registros el JSON incluye explícitamente `"orders": []`, `"totalRecords": "0"` y `"totalPages": 0`. `useOrdersStore.ts` (`result.orders ?? []`) y `orders-dashboard-panel.tsx` (`totalPages > 0`) manejan correctamente tanto el array vacío como la omisión de campos por defecto.
- Para consumir `GetOrder` desde `ordersQueryService.ts`, los endpoints equivalentes son `GET /v1/orders/{idOrden}` y `GET /v1/ordenes/{idOrden}` con cabecera `Authorization: Bearer <token>`, retornando `GetOrderResponseDto` (`{ order: OrderDto }`).
- Los precios `int64` llegan siempre serializados como cadena decimal (probado sobre PostgreSQL real con `9007199254740993 > Number.MAX_SAFE_INTEGER`), evitando truncamiento en JavaScript.

---

## 5. Ejemplos Sanitizados de Lista y Detalle (Capturados de HTTP Real + PostgreSQL 16)

Todos los payloads siguientes provienen de respuestas HTTP reales generadas por `gRPC-Gateway` contra `PostgreSQL 16.15` en `TestHTTPGateway_OrdersQueries_DBIntegration`, usando identificadores numéricos sintéticos (`501` comprador/usuario principal, `502` y `505` vendedores, `504` comprador de una venta, `503` tercero sin órdenes) y sin secretos reales.

### 5.1. Detalle autorizado (`GET /v1/orders/2` o `GET /v1/ordenes/2`)
Cabecera: `Authorization: Bearer <JWT_USUARIO_501_O_505_REDACTADO>` — HTTP `200 OK`:
```json
{
  "order": {
    "idOrden": 2,
    "idUsuarioComprador": 501,
    "idUsuarioVendedor": 505,
    "idPublicacion": 702,
    "estado": "ACEPTADA",
    "estadoStr": "ACEPTADA",
    "precio": "9007199254740993",
    "createdAt": "2026-11-21T21:06:02.840185Z",
    "updatedAt": "2026-11-21T21:21:02.840185Z"
  }
}
```

### 5.2. Listado de compras (`GET /v1/orders/mis-compras?page=1&limit=10`)
Cabecera: `Authorization: Bearer <JWT_USUARIO_501_REDACTADO>` — HTTP `200 OK`:
```json
{
  "orders": [
    {
      "idOrden": 2,
      "idUsuarioComprador": 501,
      "idUsuarioVendedor": 505,
      "idPublicacion": 702,
      "estado": "ACEPTADA",
      "estadoStr": "ACEPTADA",
      "precio": "9007199254740993",
      "createdAt": "2026-11-21T21:06:02.840185Z",
      "updatedAt": "2026-11-21T21:21:02.840185Z"
    },
    {
      "idOrden": 1,
      "idUsuarioComprador": 501,
      "idUsuarioVendedor": 502,
      "idPublicacion": 701,
      "estado": "PENDIENTE",
      "estadoStr": "PENDIENTE",
      "precio": "45000",
      "createdAt": "2026-11-21T20:51:02.840185Z",
      "updatedAt": "2026-11-21T20:51:02.840185Z"
    }
  ],
  "meta": {
    "totalRecords": "2",
    "currentPage": 1,
    "totalPages": 1,
    "limit": 10
  }
}
```

### 5.3. Listado de ventas (`GET /v1/orders/mis-ventas?page=1&limit=10`)
Cabecera: `Authorization: Bearer <JWT_USUARIO_501_REDACTADO>` — HTTP `200 OK`:
```json
{
  "orders": [
    {
      "idOrden": 3,
      "idUsuarioComprador": 504,
      "idUsuarioVendedor": 501,
      "idPublicacion": 703,
      "estado": "COMPLETADA",
      "estadoStr": "COMPLETADA",
      "precio": "60000",
      "createdAt": "2026-11-21T21:36:02.840185Z",
      "updatedAt": "2026-11-21T21:51:02.840185Z"
    }
  ],
  "meta": {
    "totalRecords": "1",
    "currentPage": 1,
    "totalPages": 1,
    "limit": 10
  }
}
```

### 5.4. Listado vacío sin registros (`GET /v1/orders/mis-compras?page=1&limit=10`)
Cabecera: `Authorization: Bearer <JWT_USUARIO_503_REDACTADO>` — HTTP `200 OK`:
```json
{
  "orders": [],
  "meta": {
    "totalRecords": "0",
    "currentPage": 1,
    "totalPages": 0,
    "limit": 10
  }
}
```

### 5.5. Respuestas de error en `GetOrder`
- **Tercero ajeno (HTTP `403 Forbidden`):** `{"code":7,"message":"no tienes autorización para consultar esta orden","details":[]}`
- **Orden inexistente o con soft-delete (HTTP `404 Not Found`):** `{"code":5,"message":"orden no encontrada","details":[]}`
- **ID en cero (`GET /v1/orders/0`, HTTP `400 Bad Request`):** `{"code":3,"message":"el id de la orden es obligatorio","details":[]}`
- **ID no numérico (`GET /v1/ordenes/abc`, HTTP `400 Bad Request`):** `{"code":3,"message":"type mismatch, parameter: id_orden, error: strconv.ParseUint: parsing \"abc\": invalid syntax","details":[]}`
- **Sin token (`GET /v1/orders/2`, HTTP `401 Unauthorized`):** `{"code":16,"message":"token de autorización no proporcionado","details":[]}`

---

## 6. Pasos Reproducibles y Matriz Esperado vs Observado

### Pasos de ejecución local
```powershell
# 1. Levantar PostgreSQL real de Orders
docker compose --profile orders up -d postgres_orders

# 2. Exportar credenciales en memoria desde .env (sin imprimir secretos)
$pw = (Get-Content .env | Where-Object { $_ -match '^POSTGRES_PASSWORD_ORDERS=' } | Select-Object -First 1) -replace '^POSTGRES_PASSWORD_ORDERS=',''
$env:DB_HOST = "localhost"
$env:DB_PORT = "5437"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = $pw.Trim()
$env:DB_NAME = "orders_db"
$env:ORDERS_ENABLE_CREATION = "true"

# 3. Análisis estático, compilación y pruebas reales sobre PostgreSQL + HTTP + gRPC
cd backend-go
go vet ./...
go build ./...
go test -v -count=1 ./internal/api/orders/...
go test -v -count=1 -run "TestOrder|TestValidateCreateOrder|TestValidateOrder|TestCreateOrder|TestPatchOrder|TestListOrders|TestGetOrder|TestModelToProtoOrder|TestBuildListOrdersResponse|TestIAMIdentityContract" ./internal/service/...

# 4. Pruebas del consumidor frontend
cd ..\frontend-marketplace
node --test src/store/useOrdersStore.test.cjs src/store/useOrderActionsStore.test.cjs src/services/ordersMutationService.test.cjs
```

### Matriz Esperado vs Observado

| Criterio | Esperado | Observado |
| :--- | :--- | :--- |
| Aislamiento compras vs ventas | Comprador y vendedor solo ven sus propias órdenes; filtros y `PaginationMeta` coherentes. | Usuario `501` obtiene exactamente 2 compras y 1 venta separadas; filtro `?estado=PENDIENTE` reduce a 1; `?page=2&limit=1` devuelve página 2 de 2 (`totalRecords: "2"`); usuario `503` recibe `orders: []`, `totalRecords: "0"`; soft-delete excluido. |
| `GetOrder` participante | Comprador y vendedor obtienen la orden persistida con IDs, `precio` `int64`, `estado`, `estadoStr` y timestamps. | HTTP `200 OK` en `/v1/orders/{id}` y `/v1/ordenes/{id}` + `codes.OK` en gRPC nativo con `"precio":"9007199254740993"` y timestamps RFC 3339 válidos. |
| `GetOrder` tercero / inexistente / inválido / sin token | Rechazos coherentes sin exponer datos ni permitir acceso ajeno. | Tercero → `403` / `PermissionDenied`; inexistente y soft-delete → `404` / `NotFound`; ID `0` / `abc` / `-1` → `400` / `InvalidArgument`; sin token → `401` / `Unauthenticated`. |
| Evidencia en PostgreSQL real sin `SKIP` | Todas las pruebas de persistencia y HTTP/gRPC corren contra PostgreSQL real. | `PostgreSQL 16.15` (`postgres_orders:5437`), **0 `FAIL`** y **0 `SKIP`** en todas las pruebas ejecutadas. |

---

## 7. Desglose de Pruebas (Aprobadas / Fallidas / Omitidas)

- **`go vet ./...` y `go build ./...` (`backend-go`):** **PASS** (exit code `0`).
- **`go test -v -count=1 ./internal/api/orders/...`:** **8 suites / 26 casos y subcasos APROBADAS**, **0 FALLIDAS**, **0 OMITIDAS (`SKIP`)** (`0.706s`).
- **`go test -v -count=1 -run "TestOrder|...|TestIAMIdentityContract" ./internal/service/...`:** **35 suites principales APROBADAS** (incluyendo `TestIAMIdentityContract` con `AuthService.Register`/`Login` reales sobre PostgreSQL y todas las pruebas de integración DB de `CreateOrder`, `PatchOrderStatus`, `GetOrder`, `ListMyPurchases` y `ListMySales`), **0 FALLIDAS**, **0 OMITIDAS (`SKIP`)** (`5.736s`). *(El paquete `internal/service/media` reportó `[no tests to run]` debido al filtro `-run` dirigido a Orders/IAM).*
- **`node --test` en `frontend-marketplace` (`useOrdersStore`, `useOrderActionsStore`, `ordersMutationService`):** **39/39 APROBADAS**, **0 FALLIDAS**, **0 OMITIDAS** (`3.83s`).

### Limitaciones conocidas
1. En los tests de router y adaptador (`router_test.go`), los JWT se firmaron localmente con secreto de prueba (`TestIAMIdentityContract` sí ejercita `Register` y `Login` reales de IAM contra PostgreSQL).
2. La verificación se ejecutó en entorno local con Docker (`postgres_orders`) y servidores HTTP/gRPC en pruebas automatizadas; no se desplegó ni probó contra el clúster Kubernetes remoto.
3. No se modificó `frontend-marketplace` (la conexión visual de un botón «Ver Detalle» sobre `OrderCard` queda fuera del alcance de este ticket backend).
