# ALL-125 — Revisión previa al refactor de Orders

## Base comprobada
- **Repositorio:** `AlvaroFPM/Allin1_Taller_de_integracion_III`
- **Commit base revisado (`develop`):** `b3dc9ad51c97bccc5bdb8aba8fc44d0449ff7bad` (`b3dc9ad`)
- **Rama de trabajo:** `refactor/ALL-125-orders-s1` (creada desde `develop` en `b3dc9ad`)
- **Estado previo del árbol de trabajo:** En `develop` existían cambios locales no confirmados ajenos a Orders (`backend-go/internal/service/auth_service.go`, `backend-go/internal/service/publication_service.go`, `backend-go/internal/api/pb/auth/auth_grpc.pb.go`, `backend-go/internal/api/pb/publication/publication_grpc.pb.go` y archivo vacío sin seguimiento `backend-go/internal/models/user.go`). Se resguardaron en `git stash` (`wip local dirty files on develop before ALL-125`) antes de crear la rama de trabajo para conservarlos sin contaminar esta revisión.
- **Alcance de esta entrega:** Revisión de responsabilidades, dependencias, duplicación, datos internos, comportamientos a preservar, definición de alcance acotado de refactor y registro separado de defectos/integraciones pendientes. **No** se añaden funciones, métodos, endpoints, campos públicos ni reglas de negocio nuevas.

---

## Inventario y trazabilidad

### 1. Arquitectura y estado de integración en `b3dc9ad`
Flujo declarado en infraestructura y contratos:
`Frontend (Next.js) → API Gateway Nginx (/v1/orders, /v1/ordenes) → [Orders gRPC-Gateway + gRPC (50053/8084) — SIN IMPLEMENTAR] → OrderService → GORM → PostgreSQL (ordenes)`

Archivos inspeccionados:
- **`backend-go/api/proto/orders.proto` (L1-153):** Contrato gRPC y HTTP/REST (`google.api.http`) para `OrderService` (`CreateOrder`, `PatchOrderStatus`, `GetOrder`, `ListMyPurchases`, `ListMySales`). Expone rutas duales `/v1/orders*` y `/v1/ordenes*`.
- **`backend-go/internal/api/pb/orders/` (`orders.pb.go`, `orders_grpc.pb.go`, `orders.pb.gw.go`) y `backend-go/api/openapi/orders.swagger.json`:** Código y OpenAPI generados desde `orders.proto`; fuera de modificación manual en el refactor.
- **`backend-go/internal/models/order.go` (L1-30):** Constantes de estado (`PENDIENTE`, `ACEPTADA`, `COMPLETADA`, `CANCELADA`), struct GORM `Orden` mapeado a la tabla `ordenes` con `fecha_creacion`, `fecha_actualizacion` y `deleted_at` (soft delete).
- **`backend-go/internal/service/order_service.go` (L1-278):** Lógica de negocio pura sobre `*gorm.DB` (`OrderService`). **No** implementa la interfaz generada `orderspb.OrderServiceServer`.
- **`backend-go/internal/service/order_service_test.go` (L1-903):** 7 tests unitarios puros (sin BD, con subcasos tabulados) y 12 tests de integración con PostgreSQL (con `t.Skipf` si no hay BD local).
- **`backend-go/cmd/` e `internal/api/`:** En `b3dc9ad` **no existen** `backend-go/cmd/orders/main.go` ni `backend-go/internal/api/orders/` (a diferencia de `cmd/chat` + `internal/api/chat`, `cmd/catalog`, `cmd/iam` y `cmd/media`).
- **Infraestructura y despliegue:**
  - `backend-go/Dockerfile.orders` (L52-53): intenta compilar `./cmd/orders` (puertos `8084` HTTP y `50053` gRPC).
  - `docker-compose.yml` (L197-255): define perfil `orders` con `postgres_orders` (puerto host `5437`, BD `orders_db`, usuario `postgres`) y servicio `orders`.
  - `backend-go/k8s/orders/deployment.yaml` y `service.yaml`: definen pod/service en puerto `8084`/`50053` con dependencias pendientes (`orders-db-config`, `orders-db-secret`, `postgres-orders`, tag `TAG_A_DEFINIR`).
  - `backend-go/k8s/gateway/configmap.yaml` (L140-200): enruta `/v1/orders` y `/v1/ordenes` hacia `http://orders.student-aalarcon.svc.cluster.local:8084`.
- **Consumidores en Frontend (`frontend-marketplace`):**
  - `src/types/dto/orders.ts` (L1-76): DTOs mapeados desde `orders.proto` / `orders.swagger.json`.
  - `src/services/orderService.ts` (L8-32): `POST /v1/orders` (`createOrder`), consumido por `src/app/publicaciones/[id]/page.tsx` (L130).
  - `src/services/ordersQueryService.ts` (L10-32): `GET /v1/orders/mis-compras` (`getPurchases`) y `GET /v1/orders/mis-ventas` (`getSales`), consumido por `src/store/useOrdersStore.ts` (L101, L107) y `src/components/shared/orders-dashboard-panel.tsx` (L46-49).
  - `src/services/ordersMutationService.ts` (L8-45): `PATCH /v1/orders/${idOrden}` (`patchStatus`, restringido en frontend a `'ACEPTADA' | 'COMPLETADA'`), consumido por `src/store/useOrderActionsStore.ts` (L94).

### 2. Recorrido detallado de `backend-go/internal/service/order_service.go`

| Bloque / Símbolo | Ubicación | Entrada → Salida | Llamadores comprobados | Efectos persistentes (BD) |
| --- | --- | --- | --- | --- |
| `transicionesValidas` | `order_service.go:16-21` | Mapa `estadoActual -> []estadoDestino` | `validateOrderTransition` (L145) | Ninguno (definición estática en memoria). |
| `OrderService` / `NewOrderService` | `order_service.go:24-31` | `db *gorm.DB` → `*OrderService` | **0 llamadores en producción.** Solo `order_service_test.go` (14 instanciaciones). | Ninguno. |
| `CreateOrder` | `order_service.go:34-68` | `(ctx, compradorID, vendedorID, publicacionID uint, precio int64)` → `(*models.Orden, error)` | Solo `order_service_test.go` (13 llamadas). | 1) `SELECT count(*)` en `ordenes` filtrando `id_usuario_comprador`, `id_publicacion` y `estado IN ('PENDIENTE', 'ACEPTADA')` (RN-22).<br>2) `INSERT` en `ordenes` con `estado = 'PENDIENTE'`. |
| `validateCreateOrder` | `order_service.go:116-133` | `(compradorID, vendedorID, publicacionID uint, precio int64)` → `error` | `CreateOrder` (L36), `TestValidateCreateOrder_PureValidation` (`order_service_test.go:150`). | Ninguno (función pura; valida IDs `!= 0`, `compradorID != vendedorID` [RN-21] y `precio > 0` [RN-23]). |
| `PatchOrderStatus` | `order_service.go:71-113` | `(ctx, ordenID, usuarioID uint, nuevoEstado string)` → `(*models.Orden, error)` | Solo `order_service_test.go` (6 llamadas: L438, 443, 453, 743, 748, 750). | 1) `SELECT` por PK (`First(&orden, ordenID)`).<br>2) `UPDATE ordenes SET estado = ?, fecha_actualizacion = ? WHERE id_orden = ? AND estado = ? AND deleted_at IS NULL`. Bloqueo optimista (`RowsAffected == 0` → `codes.Aborted`). |
| `validateOrderPermissions` | `order_service.go:160-174` | `(orden *models.Orden, usuarioID uint, nuevoEstado string)` → `error` | `PatchOrderStatus` (L90), `TestValidateOrderPermissions_PureValidation` (`order_service_test.go:408`). | Ninguno (función pura; exige ser comprador o vendedor y restringe `ACEPTADA` solo a vendedor). |
| `validateOrderTransition` | `order_service.go:136-157` | `(estadoActual, nuevoEstado string)` → `error` | `PatchOrderStatus` (L96), `TestValidateOrderTransition_PureValidation` (`order_service_test.go:311`). | Ninguno (función pura; valida dominio de `nuevoEstado` y transición permitida en `transicionesValidas`). |
| `ListMyPurchases` | `order_service.go:187-189` | `(ctx, compradorID uint, page, limit int32, estado *string)` → `([]models.Orden, int64, error)` | Solo `order_service_test.go` (15 llamadas). | Delega a `listOrdersByUser` con `columnaComprador = "id_usuario_comprador"`. |
| `ListMySales` | `order_service.go:192-194` | `(ctx, vendedorID uint, page, limit int32, estado *string)` → `([]models.Orden, int64, error)` | Solo `order_service_test.go` (3 llamadas: L622, 724, 897). | Delega a `listOrdersByUser` con `columnaVendedor = "id_usuario_vendedor"`. |
| `listOrdersByUser` | `order_service.go:197-250` | `(ctx, columna string, usuarioID uint, page, limit int32, estado *string)` → `([]models.Orden, int64, error)` | `ListMyPurchases` (L188), `ListMySales` (L193). | Solo lectura:<br>1) `SELECT count(*)` sobre `baseQuery.Session(&gorm.Session{})` con filtro usuario y `estado` opcional.<br>2) Si `totalRecords > 0`, `SELECT` paginado con `ORDER BY fecha_creacion DESC, id_orden DESC`. |
| `normalizePagination` | `order_service.go:253-265` | `(page, limit int32)` → `(int32, int32, int)` | `listOrdersByUser` (L208), `TestOrder_NormalizePagination_PureValidation` (`order_service_test.go:543`). | Ninguno (función pura; `page < 1 → 1`, `limit <= 0 → 10`, `limit > 100 → 100`, `offset` en `int`). |
| `validateOrderFilterState` | `order_service.go:268-278` | `(estado string)` → `error` | `listOrdersByUser` (L215), `TestValidateOrderFilterState_PureValidation` (`order_service_test.go:593`), `TestListOrders_InvalidState_ReturnsInvalidArgument_Pure` (`order_service_test.go:657`). | Ninguno (función pura; permite `""` o los 4 estados válidos). |

---

## Hallazgos: duplicación, nombres ambiguos, ramas y datos internos

### 1. Duplicación localizada
1. **Validación repetida del conjunto de los 4 estados válidos de orden:**
   - `validateOrderTransition` (`order_service.go:138-142`) hace un `switch` sobre los 4 estados (`PENDIENTE`, `ACEPTADA`, `COMPLETADA`, `CANCELADA`) y retorna `codes.InvalidArgument` con `"estado de orden desconocido: %s"`.
   - `validateOrderFilterState` (`order_service.go:272-277`) repite el mismo `switch` sobre los mismos 4 estados y retorna `codes.InvalidArgument` con `"estado de orden inválido: %s"`.
   - Las 4 claves ya existen como mapa único de verdad en `transicionesValidas` (`order_service.go:16-21`).
2. **Normalización de paginación repetida entre servicios (fuera de Orders, solo referencia):**
   - `publication_service.go:115-125` y `chat_service.go:64-71` implementan normalización de paginación en línea con reglas propias (`limit=10` en Orders/Catalog vs `limit=50` y `offset` directo en Chat). No debe unificarse entre dominios en este refactor.

### 2. Datos internos que viajan o se descartan sin uso (con verificación de consumidores)
1. **`pageNorm` devuelto por `normalizePagination` y descartado en `listOrdersByUser` (`order_service.go:208`):**
   - `_, limitNorm, offset := normalizePagination(page, limit)` descarta el primer valor retornado (`page`).
   - **Consumidores comprobados:** `TestOrder_NormalizePagination_PureValidation` (`order_service_test.go:543-544`) **sí** consume y aserta `gotPage`. Además, `orders.proto:33-38` (`PaginationMeta.current_page`) necesitará `pageNorm` cuando exista el adaptador gRPC. **Decisión:** conservar la firma de `normalizePagination`.
2. **`ListMyPurchasesRequest` y `ListMySalesRequest` idénticos en `orders.proto:77-88`:**
   - Tienen exactamente los mismos campos (`page`, `limit`, `optional estado`).
   - **Consumidores comprobados:** `orders.pb.go`, `orders_grpc.pb.go`, `orders.pb.gw.go`, `orders.swagger.json`, `frontend-marketplace/src/types/dto/orders.ts:61-71`, `ordersQueryService.ts:3-4`, `useOrdersStore.ts:5-6`. **Decisión:** no modificar ni fusionar porque forman parte del contrato público `.proto`/OpenAPI/DTO.
3. **`Order.estado` (enum `EstadoOrden`) y `Order.estado_str` (string) en `orders.proto:25-26`:**
   - **Consumidores comprobados:** `frontend-marketplace/src/types/dto/orders.ts:15-16` declara ambos y `ordersMutationService.ts:36` valida `order.estado !== nuevoEstado`. **Decisión:** conservar ambos en el contrato público.
4. **Rutas duales `/v1/orders` y `/v1/ordenes` en `orders.proto:103-151` y `k8s/gateway/configmap.yaml:140-200`:**
   - **Consumidores comprobados:** el frontend actual consume `/v1/orders` (`orderService.ts:23`, `ordersMutationService.ts:24`, `ordersQueryService.ts:16,27`), pero `/v1/ordenes` está publicada en Swagger y Gateway. **Decisión:** conservar ambas.

### 3. Nombres ambiguos, comentarios desalineados y ramas/guardas
1. **Nombre `OrderService` vs `*ServiceServer` (`order_service.go:24`):**
   - `PublicationServiceServer` y `ChatServiceServer` implementan directamente sus servidores gRPC (`Unimplemented*Server`). `OrderService` es un servicio de dominio puro sobre Go primitivos y `*models.Orden`, sin capa gRPC aún. Se mantiene el nombre para no romper tests ni futuros consumidores hasta el sprint de router gRPC.
2. **Comentario desalineado en `order_service_test.go:21`:**
   - El comentario dice `// getEnvOrDefault obtiene una variable de entorno...`, pero la función declarada en L23 es `getOrderTestEnv`.
3. **Guarda defensiva `columna != columnaComprador && columna != columnaVendedor` (`order_service.go:203-205`):**
   - Con los llamadores actuales (`ListMyPurchases`, `ListMySales`), esa rama nunca se activa; sin embargo, `listOrdersByUser` concatena `columna` directamente en `Where(columna+" = ?", usuarioID)` (L222). Conservar esta guarda es necesario para seguridad contra inyección SQL si recibe un `string`.
4. **Asignación de `ordenes := make([]models.Orden, 0)` antes de `if totalRecords > 0` (`order_service.go:236-246`):**
   - Si `totalRecords == 0`, igualmente atraviesa la condición en lugar de retornar temprano `make([]models.Orden, 0), 0, nil`.
5. **Orden de validaciones en `PatchOrderStatus` (`order_service.go:82-98`):**
   - Actualmente ejecuta: 1) `ordenID == 0` / `usuarioID == 0` (`InvalidArgument`), 2) `SELECT First` (`NotFound` / `Internal`), 3) `validateOrderPermissions` (`PermissionDenied`), 4) `validateOrderTransition` (valida dominio de `nuevoEstado` con `InvalidArgument` y transición con `FailedPrecondition`).
   - Reordenar la validación de `nuevoEstado` antes de la consulta a BD o antes de `validateOrderPermissions` cambiaría qué código gRPC gana cuando una orden no existe o un tercero envía un estado desconocido. **Debe preservarse el orden actual** salvo definición explícita posterior.
6. **Ausencia de guardas `s.db == nil` en rutas con BD (`order_service.go:42, 82, 220`):**
   - `TestListOrders_UserZero_ReturnsUnauthenticated_Pure` y `TestListOrders_InvalidState_ReturnsInvalidArgument_Pure` pasan `NewOrderService(nil)` y funcionan solo porque las validaciones tempranas retornan antes de consultar `s.db`. Cualquier llamada con datos válidos y `s.db == nil` produciría `nil pointer dereference` (a diferencia de `chat_service.go`, que verifica `if s.db != nil`).

---

## Alcance acotado de refactor propuesto (para S2)
Cambios estrictamente locales dentro de código existente, sin añadir funciones, métodos, endpoints, dependencias ni alterar contratos o comportamiento observable:

1. **Eliminar la duplicación del `switch` de estados en `backend-go/internal/service/order_service.go`:**
   - En `validateOrderTransition` (`L138-142`) y `validateOrderFilterState` (`L272-277`), validar pertenencia al dominio consultando el mapa `transicionesValidas` (`_, ok := transicionesValidas[estado]`), ya existente en `L16-21`, manteniendo intactos los códigos gRPC (`codes.InvalidArgument`) y los textos exactos (`"estado de orden desconocido: %s"` en `validateOrderTransition` y `"estado de orden inválido: %s"` en `validateOrderFilterState`).
2. **Simplificar flujo con retorno temprano en `listOrdersByUser` (`backend-go/internal/service/order_service.go:236-246`):**
   - Si `totalRecords == 0`, retornar `make([]models.Orden, 0), 0, nil` de forma anticipada para reducir un nivel de anidamiento en `Find(&ordenes)` preservando el slice no-nil (`[]models.Orden{}`).
   - Documentar con comentario breve en L208 que `normalizePagination` conserva el retorno `page` por contrato de tests unitarios y futuro cálculo de `PaginationMeta`.
3. **Corregir comentario de función en `backend-go/internal/service/order_service_test.go:21`:**
   - Alinear `// getEnvOrDefault ...` con el nombre real `getOrderTestEnv`. (No cambiar puertos/credenciales por defecto en este paso para no romper entornos locales que hoy usan `postgres_catalog` en `5434`).

**Fuera de alcance en este refactor:** modificar `orders.proto`, regenerar `pb/orders`, alterar `models/order.go`, cambiar el orden de validaciones de `PatchOrderStatus`, introducir nuevas funciones públicas o privadas, o implementar `cmd/orders` / `GetOrder`.

---

## Comportamientos a preservar y comprobación antes/después definida

### Comportamientos obligatorios a preservar
1. **`CreateOrder` / `validateCreateOrder`:** Rechazo de IDs en `0` (`InvalidArgument`), rechazo de auto-compra `compradorID == vendedorID` (`InvalidArgument`, `RN-21`), rechazo de `precio <= 0` (`InvalidArgument`, `RN-23`), bloqueo de orden duplicada en estado `PENDIENTE` o `ACEPTADA` para el mismo `(compradorID, publicacionID)` (`AlreadyExists`, `RN-22`), permisión de nueva orden si previas están `COMPLETADA`, `CANCELADA` o con soft delete, y persistencia inicial con `Estado = "PENDIENTE"`.
2. **`PatchOrderStatus` / `validateOrderPermissions` / `validateOrderTransition`:**
   - Precedencia actual de errores: IDs en `0` → consulta BD (`NotFound` si no existe) → permisos (`PermissionDenied`: solo comprador/vendedor, y `ACEPTADA` exclusiva del vendedor) → dominio de `nuevoEstado` (`InvalidArgument` con texto `"estado de orden desconocido: ..."`) → FSM (`FailedPrecondition` para estados finales `COMPLETADA`/`CANCELADA` o saltos/regresiones).
   - Actualización atómica restringida a columna `estado` con condición `Where("estado = ?", estadoAnterior)` y retorno `codes.Aborted` si `RowsAffected == 0`.
3. **`ListMyPurchases` / `ListMySales` / `listOrdersByUser` / `normalizePagination` / `validateOrderFilterState`:**
   - `usuarioID == 0` → `codes.Unauthenticated`.
   - `estado != nil` → `strings.TrimSpace(*estado)`; `""` no filtra; estado desconocido → `codes.InvalidArgument` con texto `"estado de orden inválido: ..."`.
   - Normalización: `page < 1 → 1`, `limit <= 0 → 10`, `limit > 100 → 100`, cálculo de `offset` en `int` sin desbordamiento `int32`.
   - Aislamiento estricto por columna (`id_usuario_comprador` vs `id_usuario_vendedor`), conteo previo aislado con `Session(&gorm.Session{})`, orden `fecha_creacion DESC, id_orden DESC`, exclusión automática de soft-delete GORM, y retorno de slice no-nil (`len == 0`, no `nil`) cuando no hay resultados.

### Plan de comprobación antes/después (para ejecutar al aplicar S2)
1. **Compilación completa:** `cd backend-go && go build ./...` (debe mantener código de salida `0`).
2. **Pruebas unitarias puras de Orders (antes y después):**
   ```powershell
   go test -v ./internal/service -run "TestValidateCreateOrder|TestValidateOrderTransition|TestValidateOrderPermissions|TestOrder_NormalizePagination|TestValidateOrderFilterState|TestListOrders_UserZero|TestListOrders_InvalidState" -count=1
   ```
   Debe mantener 100% PASS en los 7 tests unitarios puros y todos sus subcasos, comparando explícitamente códigos `status.Code(err)` y mensajes exactos de error.
3. **Pruebas de integración con PostgreSQL aislado:** Levantar contenedor PostgreSQL local (puerto `5434` o variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) y ejecutar:
   ```powershell
   go test -v ./internal/service -run "TestCreateOrder|TestPatchOrderStatus|TestListOrders" -count=1
   ```
   Verificar que los 12 tests actualmente omitidos (`SKIP`) pasen sin regresiones antes y después del cambio.

---

## Listado separado de defectos e integraciones pendientes (semanas posteriores)
1. **Falta de entrypoint e interfaz gRPC/Gateway para Orders:** `backend-go/cmd/orders/main.go` y `backend-go/internal/api/orders/` no existen en `b3dc9ad`. `Dockerfile.orders:53`, `docker-compose.yml:242-255`, `k8s/orders/*` y `k8s/gateway/configmap.yaml:140-200` apuntan a un binario/servidor aún no implementado.
2. **Operación `GetOrder` declarada sin implementar:** `orders.proto:68-74,125-132` (`GET /v1/orders/{id_orden}`) y `frontend-marketplace/src/types/dto/orders.ts:53-59` definen `GetOrder`, pero `order_service.go` no tiene método para consultar detalle por ID con control de pertenencia.
3. **`PaginationMeta` incompleta en servicio:** `orders.proto:33-38,91-94` exige `total_records`, `current_page`, `total_pages` y `limit`, pero `ListMyPurchases` y `ListMySales` solo devuelven `([]models.Orden, int64, error)` y `listOrdersByUser` descarta `pageNorm`.
4. **Falta de validación cruzada entre servicios y origen del `compradorID` en `CreateOrder`:** `CreateOrder` (`order_service.go:34-68`) recibe `compradorID`, `vendedorID` y `precio` sin consultar al microservicio Catalog (existencia/estado activo de publicación, dueño real y precio real) ni extraer el `compradorID` desde `middleware.UserIDKey` en capa gRPC (nótese que `orders.proto:45-49` `CreateOrderRequest` no recibe `id_usuario_comprador`).
5. **Cancelación restringida en frontend vs FSM backend:** `frontend-marketplace/src/services/ordersMutationService.ts:4,18-21` bloquea `'CANCELADA'` desde JS aunque la FSM de `order_service.go:17-18` la permite para comprador y vendedor.
6. **Tests de integración de Orders apuntando por defecto a `catalog_db` (`5434`):** `order_service_test.go:40-44` usa `localhost:5434` (`catalog_user` / `catalog_db`) en vez de `postgres_orders` (`5437` / `orders_db` definido en `docker-compose.yml:197-206`), y omite las 12 pruebas (`t.Skipf`) cuando no hay BD local ni en CI.
7. **Manifiestos K8s incompletos:** `backend-go/k8s/orders/` solo tiene `deployment.yaml` y `service.yaml`; faltan `orders-db-config`, `orders-db-secret`, manifiesto de `postgres-orders` y reemplazo de `TAG_A_DEFINIR` (`k8s/orders/deployment.yaml:7-12,40`).
8. **Guarda `s.db == nil` ausente en `OrderService` y comentario desactualizado en `docker-compose.yml`:** `order_service.go` entra en `panic` si se llama con `db == nil` y datos válidos; `docker-compose.yml:191` sigue indicando que no existe `backend-go/cmd/chat` aunque ya fue creado.

---

## Evidencia de comprobaciones ejecutadas y limitaciones
Fecha de ejecución: `2026-11-11` (`go version go1.27.1 windows/amd64`, rama `refactor/ALL-125-orders-s1` sobre `b3dc9ad`).

1. **`go build ./...` (en `backend-go/`):**
   - Resultado: **PASS** (`BUILD_EXIT=0`).
2. **Suite específica de `OrderService` (`go test -v ./internal/service -run "TestValidateCreateOrder|TestCreateOrder|TestValidateOrderTransition|TestValidateOrderPermissions|TestPatchOrderStatus|TestOrder_NormalizePagination|TestValidateOrderFilterState|TestListOrders" -count=1`):**
   - Resultado global del comando: **PASS** (`ok github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/service 0.456s`).
   - Desglose observado:
     - **PASS (7 funciones de test unitario puro con todos sus subcasos):** `TestValidateCreateOrder_PureValidation` (7 subcasos), `TestValidateOrderTransition_PureValidation` (9 subcasos), `TestValidateOrderPermissions_PureValidation` (9 subcasos), `TestOrder_NormalizePagination_PureValidation` (8 subcasos), `TestValidateOrderFilterState_PureValidation` (6 subcasos), `TestListOrders_UserZero_ReturnsUnauthenticated_Pure`, `TestListOrders_InvalidState_ReturnsInvalidArgument_Pure`.
     - **SKIP (12 tests de integración con BD):** `TestCreateOrder_Success`, `TestCreateOrder_DuplicateActiveOrder_Rejected_RN22`, `TestCreateOrder_AllowsNewOrderIfPreviousWasCancelledOrCompleted`, `TestPatchOrderStatus_SuccessCycle`, `TestPatchOrderStatus_FailsIfOrderNotFound`, `TestListOrders_AislamientoPorComprador`, `TestListOrders_ComprasYVentasNoSeMezclan`, `TestListOrders_FiltroPorEstado`, `TestListOrders_Paginacion`, `TestListOrders_OrdenDescendenteFecha`, `TestListOrders_SoftDelete_OrdenEliminadaNoAparece`, `TestListOrders_UsuarioSinOrdenes_RetornaSliceVacioYTotalCero` (omitidas por PostgreSQL local no disponible en `localhost:5434`).
3. **Otros paquetes Go sin dependencia de BD (`go test ./internal/api/... ./internal/middleware/... ./internal/models/... ./internal/database/... -count=1`):**
   - Resultado: **PASS** (`internal/api/chat` 0.394s, `internal/api/media` 2.295s, `internal/middleware` 0.244s; paquetes `pb/*`, `models` y `database` sin archivos de test).
4. **Suite completa `go test ./internal/service ./internal/middleware -count=1`:**
   - Resultado: `internal/middleware` **PASS** (0.343s); `internal/service` **FAIL** (0.897s) debido a que `auth_service_test.go` (`5433`, `iam_db`) y `publication_service_test.go` (`5434`, `catalog_db`) requieren contenedores PostgreSQL levantados. No atribuible a Orders.

**Limitaciones registradas:**
- No se levantó PostgreSQL local en esta sesión, por lo que los **12 tests de integración con BD de `order_service_test.go`** quedaron en estado `SKIP` (no verifican SQL generado ni persistencia real en esta corrida).
- No se ejecutaron pruebas de frontend (`npm run lint` / `npm run build` / tests `.mjs`/`.cjs`), compilación `protoc`, contenedores Docker ni despliegue en clúster Kubernetes.
