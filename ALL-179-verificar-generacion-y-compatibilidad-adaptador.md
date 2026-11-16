# ALL-179 — [Sprint final S2] [Orders] Verificar generación y compatibilidad del adaptador con el contrato

- **Responsable:** Alvaro Pinilla
- **Presupuesto:** 1 punto (1 hora) — Completa la asignación semanal de 5 puntos para Alvaro (ALL-137: 2 pts + ALL-138: 2 pts + ALL-179: 1 pt = 5 pts).
- **Rama de trabajo:** `qa/ALL-179-orders-verificar-generacion-y-compatibilidad`
- **Línea base:** `develop` en `14faae7` (tras la integración oficial de ALL-138 en PR #333).
- **Fecha de ejecución:** 15-11-2026
- **Dependencia directa:** [ALL-138](https://linear.app/allin1/issue/ALL-138/sprint-final-s2-orders-conectar-crear-orden-con-el-contrato-y-la).

---

## 1. Objetivo y Alcance

Verificar de forma rigurosa la generación de código y la compatibilidad integral del adaptador gRPC/Gateway (`OrderServiceServer`) con el contrato oficial definido en `backend-go/api/proto/orders.proto` y su especificación OpenAPI `orders.swagger.json`. 

El alcance incluye:
1. Comprobar que la compilación y el adaptador satisfacen formalmente la interfaz `OrderServiceServer` generada por Protobuf en tiempo de compilación y ejecución.
2. Validar que las rutas principales `/v1/orders` y sus alias declarados `/v1/ordenes` resuelven hacia la misma lógica de transporte y negocio.
3. Contrastar y comprobar los esquemas de mensajes, parámetros y nombres de propiedades JSON (camelCase, manejo de `int64` como string, estados enum) que consume el cliente web (`frontend-marketplace`).
4. Registrar con total transparencia el estado funcional de cada RPC, garantizando que ningún método generado sea anunciado como disponible sin estar plenamente implementado.

---

## 2. Verificación de Generación y Compilación

### 2.1. Pipeline de Generación con Protoc y Makefile
El archivo de especificación `backend-go/api/proto/orders.proto` es procesado mediante el Makefile del backend Go (`backend-go/Makefile`):
```makefile
protoc -I=$(PROTO_DIR) -I=third_party \
    --go_out=$(OUT_DIR)/orders --go_opt=paths=source_relative \
    --go-grpc_out=$(OUT_DIR)/orders --go-grpc_opt=paths=source_relative \
    --grpc-gateway_out=$(OUT_DIR)/orders --grpc-gateway_opt=paths=source_relative \
    --openapiv2_out=$(OPENAPI_DIR) --openapiv2_opt=logtostderr=true \
    $(PROTO_DIR)/orders.proto
```
Artefactos generados correspondientes:
- `backend-go/internal/api/pb/orders/orders.pb.go`: estructuras de datos de mensajes Protobuf.
- `backend-go/internal/api/pb/orders/orders_grpc.pb.go`: interfaces de cliente y servidor gRPC (`OrderServiceClient`, `OrderServiceServer`).
- `backend-go/internal/api/pb/orders/orders.pb.gw.go`: reverse-proxy HTTP gRPC-Gateway con bindings REST.
- `backend-go/api/openapi/orders.swagger.json`: documentación OpenAPI 2.0.

### 2.2. Cumplimiento de la Interfaz `OrderServiceServer`
Para evitar discrepancias en tiempo de compilación entre el adaptador y los stubs generados, se incorporó la aserción estricta de interfaz en [order_service_server.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_server.go):
```go
// Verificación estricta en tiempo de compilación de que OrderServiceServer satisface la interfaz generada por Protobuf (ALL-179).
var _ orderspb.OrderServiceServer = (*OrderServiceServer)(nil)
```
Se añadió además la prueba unitaria `TestOrderServiceServer_InterfaceCompliance` en [order_service_server_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_server_test.go), la cual pasa al 100%.

Linteo y compilación general:
- `go vet ./...` -> **PASS** (código 0).
- `go build ./cmd/orders` -> **PASS** (código 0).

---

## 3. Compatibilidad de Rutas y Alias HTTP (/v1/orders y /v1/ordenes)

El contrato `orders.proto` define mediante `additional_bindings` los alias en español para cada ruta REST expuesta por gRPC-Gateway. En `backend-go/internal/api/orders/router_test.go`, se comprobaron ambos pares de rutas:

| Operación RPC | Ruta Primaria | Alias Declarado | Método HTTP | Resultado de Equivalencia |
|---|---|---|---|---|
| `CreateOrder` | `/v1/orders` | `/v1/ordenes` | POST | Comprobado: ambas rutas procesan autenticación, validación RN-21, RN-23 y campos idénticamente. |
| `PatchOrderStatus` | `/v1/orders/{id_orden}` | `/v1/ordenes/{id_orden}` | PATCH | Comprobado: ambas rutas extraen `{id_orden}` de la URL y aceptan payload JSON. |
| `GetOrder` | `/v1/orders/{id_orden}` | `/v1/ordenes/{id_orden}` | GET | Comprobado: ambas rutas retornan HTTP 501 Unimplemented (ALL-149). |
| `ListMyPurchases` | `/v1/orders/mis-compras` | `/v1/ordenes/mis-compras` | GET | Comprobado: ambas rutas reciben query params (`page`, `limit`, `estado`) y consultan compras del usuario autenticado. |
| `ListMySales` | `/v1/orders/mis-ventas` | `/v1/ordenes/mis-ventas` | GET | Comprobado: ambas rutas reciben query params y consultan ventas del usuario autenticado. |

---

## 4. Compatibilidad de Nombres JSON y Mensajes con el Frontend

Se realizó una revisión cruzada exhaustiva contra los consumidores del frontend en `frontend-marketplace`:
1. `src/types/dto/orders.ts` (DTOs TypeScript).
2. `src/services/orderService.ts` (Servicio de creación de órdenes).
3. `src/services/ordersMutationService.ts` (Servicio de transiciones de estado PATCH).
4. `src/services/ordersQueryService.ts` (Servicio de consultas GET compras/ventas).
5. `src/app/publicaciones/[id]/page.tsx` (Página de detalle y confirmación de contratación).
6. `src/lib/mappers/orders.ts` (Transformador de DTOs a modelos del Dashboard).

### 4.1. Análisis Request / Response de Creación de Orden
- **Petición del Frontend (`CreateOrderRequestDto`):**
  - Campos enviados: `idUsuarioVendedor` (number), `idPublicacion` (number), `precio` (string).
  - Comprador: Se omite del cuerpo HTTP para evitar suplantación; se inyecta desde el token JWT (`middleware.UserIDKey`).
  - Compatibilidad: gRPC-Gateway deserializa nombres en camelCase (`idUsuarioVendedor`, `idPublicacion`) y mapea cadenas numéricas `"25000"` directamente a `int64` sin pérdida de precisión ni overflow en JavaScript.
- **Respuesta de Creación (`CreateOrderResponseDto`):**
  - Retorna objeto `order` conteniendo: `idOrden` (number), `idUsuarioComprador` (number), `idUsuarioVendedor` (number), `idPublicacion` (number), `estado` ("PENDIENTE"), `estadoStr` ("PENDIENTE"), `precio` (string `"25000"` para preservar precisión int64 en TypeScript), `createdAt` y `updatedAt` (RFC 3339).
  - Incluye `message`: `"Orden creada exitosamente"`.
  - La interfaz de usuario (`publicaciones/[id]/page.tsx`) lee `result.order?.idOrden` y muestra el banner de confirmación: `"Orden {orderId} creada correctamente."`.

### 4.2. Análisis Request / Response de Transición de Estado (`PatchOrderStatus`)
- **Petición del Frontend (`ordersMutationService.ts`):**
  - Envía `PATCH /v1/orders/{idOrden}` con cuerpo `{ "nuevoEstado": "ACEPTADA" }`.
  - Compatibilidad: El Gateway inyecta `idOrden` desde el path parameter y deserializa `nuevoEstado` en camelCase hacia `nuevo_estado`.
- **Respuesta:**
  - Retorna `order` con el estado actualizado y `message`: `"Estado de la orden actualizado exitosamente"`.

### 4.3. Verificación Automatizada de Compatibilidad JSON (protojson)
En `router_test.go`, la prueba `TestProtoJSON_FrontendCompatibility` verifica:
- Deserialización de `CreateOrderRequest` en camelCase con precios en formato texto y número -> **PASS**.
- Serialización de `CreateOrderResponse` garantizando las claves exactas camelCase esperadas por el frontend y la serialización de `int64` como string -> **PASS**.
- Deserialización de `PatchOrderStatusRequest` con `nuevoEstado` en camelCase -> **PASS**.
- Serialización de `ListOrdersResponse` con metadatos de paginación (`totalRecords` como string int64) -> **PASS**.

---

## 5. Transparencia del Contrato y Operaciones Pendientes

En cumplimiento del criterio de aceptación *"No hay métodos anunciados como funcionales solo por su generación"*, se registra expresamente el estado de cada una de las 5 operaciones definidas en `orders.proto`:

| Operación RPC | Endpoint HTTP | Estado Funcional | Detalle de Implementación y Coordinación |
|---|---|---|---|
| `CreateOrder` | `POST /v1/orders`<br>`POST /v1/ordenes` | **Salvaguarda Activa** (501 por defecto / Funcional bajo bandera) | El adaptador y la persistencia están completamente implementados y probados. Por defecto retorna `codes.Unimplemented` (HTTP 501) en despliegue público para proteger la integridad de datos hasta coordinar la validación cruzada con Catálogo en **ALL-141** (Nicolás Fuentes). Se habilita controladamente con `ORDERS_ENABLE_CREATION=true`. |
| `PatchOrderStatus` | `PATCH /v1/orders/{id}`<br>`PATCH /v1/ordenes/{id}` | **100% Funcional** | Aplica FSM (`PENDIENTE` -> `ACEPTADA` -> `COMPLETADA` / `CANCELADA`), validando estrictamente que el solicitante sea el vendedor o comprador según la transición permitida. |
| `GetOrder` | `GET /v1/orders/{id}`<br>`GET /v1/ordenes/{id}` | **Pendiente Declarado** (501 Not Implemented) | Retorna explícitamente `codes.Unimplemented` ("operación GetOrder no implementada en esta fase (registrada para sprint posterior ALL-149)"). No se finge funcionalidad inexistente. |
| `ListMyPurchases` | `GET /v1/orders/mis-compras`<br>`GET /v1/ordenes/mis-compras` | **100% Funcional** | Consulta las compras donde `id_usuario_comprador` coincide con el JWT autenticado, con paginación (`page`, `limit`) y filtro por estado. |
| `ListMySales` | `GET /v1/orders/mis-ventas`<br>`GET /v1/ordenes/mis-ventas` | **100% Funcional** | Consulta las ventas donde `id_usuario_vendedor` coincide con el JWT autenticado, con paginación y filtro por estado. |

---

## 6. Resultados de Verificación y Pruebas

### 6.1. Pruebas Backend Go
- `go vet ./...` -> **PASS** (0 errores de análisis estático).
- `go build ./cmd/orders` -> **PASS** (compilación limpia del ejecutable).
- `go test -v ./internal/api/orders/...`:
  - 5 suites / 21 subcasos -> **100% PASS** (0.357s).
- `go test -v -run "TestOrderService" ./internal/service/...`:
  - 6 suites / 23 subcasos de servicio y adaptador -> **100% PASS** (0.495s).

### 6.2. Pruebas Frontend Marketplace
- `node --test frontend-marketplace/src/services/ordersMutationService.test.cjs`:
  - 6 subcasos de mutación -> **100% PASS** (0.98s).
- `node --test frontend-marketplace/src/store/useOrderActionsStore.test.cjs frontend-marketplace/src/store/useOrdersStore.test.cjs`:
  - 33 subcasos de store y sincronización UI -> **100% PASS** (2.71s).

---

## 7. Conclusión

El adaptador gRPC `OrderServiceServer` y su gateway REST cumplen rigurosamente el contrato definido en `orders.proto` y `orders.swagger.json`. Existe total coherencia con las estructuras y nombres JSON consumidos por `frontend-marketplace`. Las operaciones pendientes y salvaguardas temporales están documentadas con precisión, garantizando un cierre transparente y verificable para la tarea ALL-179.
