# ALL-150 — [Sprint final S3] [Orders MVP] Habilitar creación validada y cerrar el recorrido de estados

- **Responsable:** Álvaro Felipe Pinilla Martínez (`@AlvaroFPM`)
- **Coordinación y Revisores:** Amaro Alarcón (`@Am4ro-aaa`, infraestructura/K8s y `CATALOG_GRPC_ADDR` / `ORDERS_ENABLE_CREATION`) y Francisco Barriga (`@fbarriga2024`, flujo frontend MVP)
- **Presupuesto de planificación:** 2 puntos (2 horas)
- **Rama de trabajo:** `feat/ALL-150-orders-habilitar-creacion-y-estados`
- **Línea base contrastada:** `develop` en `d33e329` (`Merge pull request #351 from AlvaroFPM/ALL-157-perfil-foto-persistente`, incluyendo `ALL-149` en `6597503`, `ALL-143` en `3f3597f`, `ALL-180` en `f582777` y `9f81985`).
- **Fecha de ejecución:** 21-11-2026
- **Versión y entorno verificados:**
  - Go: `go version go1.27.1 windows/amd64`
  - Base de datos real: `PostgreSQL 16.15` (contenedor Docker `postgres_orders`, puerto `5437`, base `orders_db`)
  - Validación de Compose: `docker compose --profile orders config --quiet` (Exit `0`)

---

## 1. Objetivo y Comprobación de Dependencias (`ALL-138` y `ALL-141`)

Habilitar de forma segura y explícita la creación validada de órdenes (`CreateOrder`) conectada por gRPC real a Catálogo, impedir la contratación de publicaciones de tipo `DEMANDA`, y validar de extremo a extremo el ciclo de vida de estados vigente (`PatchOrderStatus`: `PENDIENTE` → `ACEPTADA` → `COMPLETADA` y cancelaciones desde `PENDIENTE` o `ACEPTADA`) sobre PostgreSQL real, IAM real y Catálogo real.

### Verificación de integraciones previas
- **ALL-138** (`OrderServiceServer.CreateOrder`): toma `compradorID` exclusivamente desde `extractUserID(ctx)` (JWT validado por `middleware.UnaryAuthInterceptor()`), mantiene la salvaguarda por defecto `ORDERS_ENABLE_CREATION != "true"` para evitar habilitación accidental sin configurar entorno.
- **ALL-141** (`OrderService.verifyPublication` y `cmd/orders/main.go`): consulta `PublicationGetter.GetPublication` con timeout de `3s`, verifica `Estado == ACTIVO`, valida coincidencia de `vendedorID` y `precio`, impide auto-contratación (`RN-21`) y falla con `codes.Unavailable` (HTTP `503`) si Catálogo no responde.
- **Reutilización de `PatchOrderStatus`:** se conservó sin reescritura `OrderService.PatchOrderStatus`, `validateOrderTransition`, `validateOrderPermissions` y el control condicionado por estado previo (`Where("estado = ?", estadoAnterior)`), comprobando su comportamiento y rechazo de carrera (`codes.Aborted`) directamente sobre PostgreSQL real.

---

## 2. Archivos Afectados

| Archivo | Cambio realizado |
| :--- | :--- |
| [order_service.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service.go) | Bloqueo explícito de publicaciones que no sean `TipoServicio_OFERTA` en `verifyPublication` (rechaza `DEMANDA` y `TIPO_SERVICIO_UNSPECIFIED` con `codes.FailedPrecondition`). |
| [order_service_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/service/order_service_test.go) | Helper `activePub` tipado como `OFERTA`; nuevas pruebas `TestCreateOrder_RejectsNonOferta_ALL150` y `TestPatchOrderStatus_OptimisticLockAndUpdatedAt` en PostgreSQL real. |
| [lifecycle_integration_test.go](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/internal/api/orders/lifecycle_integration_test.go) | Prueba de integración real sin mocks (`TestHTTPGateway_OrdersLifecycle_RealServices`): levanta IAM real + Catálogo real + Orders conectado por gRPC TCP real + Gateway HTTP + PostgreSQL 16.15 real. |
| [docker-compose.yml](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/docker-compose.yml) | Inyecta `CATALOG_GRPC_ADDR: catalog:50051`, `ORDERS_ENABLE_CREATION: ${ORDERS_ENABLE_CREATION:-true}` y `depends_on: catalog: condition: service_started` en el servicio `orders`; actualiza comentario de perfiles. |
| [service.yaml (catalog)](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/k8s/catalog/service.yaml) | Expone el puerto gRPC `50052` (`name: grpc`) ya configurado en `k8s/catalog/deployment.yaml` y `k8s/catalog/configmap.yaml`. |
| [deployment.yaml (orders)](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/k8s/orders/deployment.yaml) | Configura explícitamente `CATALOG_GRPC_ADDR: "catalog.student-aalarcon.svc.cluster.local:50052"` y `ORDERS_ENABLE_CREATION: "true"` con nota de coordinación para `@Am4ro-aaa`. |
| [ALL-150-habilitar-creacion-y-recorrido-estados-orders.md](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/ALL-150-habilitar-creacion-y-recorrido-estados-orders.md) | Evidencia reproducible, matriz Esperado/Observado y registro de pruebas para cierre y coordinación. |

### Nota de coordinación de infraestructura (`@Am4ro-aaa`)
- En **Docker Compose**, `catalog` escucha gRPC en `50051`, por lo que `orders` queda configurado con `CATALOG_GRPC_ADDR=catalog:50051` y `ORDERS_ENABLE_CREATION=true` (sobreescribible por entorno).
- En **Kubernetes** (`namespace: student-aalarcon`), `k8s/catalog/configmap.yaml` y `k8s/catalog/deployment.yaml` exponen gRPC en `50052`, pero `k8s/catalog/service.yaml` solo publicaba HTTP `8082`. Para que `orders` opere con `ORDERS_ENABLE_CREATION=true` en el clúster, se debe aplicar primero [k8s/catalog/service.yaml](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/k8s/catalog/service.yaml) actualizado con el puerto `50052` y luego [k8s/orders/deployment.yaml](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/k8s/orders/deployment.yaml) con el tag de imagen publicado.

---

## 3. Evidencia Observada del Recorrido Completo (IAM + Catálogo + Orders + PostgreSQL Real)

En `TestHTTPGateway_OrdersLifecycle_RealServices` se registraron e iniciaron sesión **3 cuentas reales** en IAM (`vendedor`, `comprador`, `tercero`), se crearon publicaciones reales en Catálogo (`OFERTA` activa `precioBase=35000`, `DEMANDA` activa `precioBase=20000`, `OFERTA` en estado `PAUSADO`) y se ejecutaron llamadas HTTP reales sobre `gRPC-Gateway`:

1. **Creación validada de `OFERTA` activa (`POST /v1/orders`, HTTP `200 OK`):**
```json
{"order":{"idOrden":36,"idUsuarioComprador":2,"idUsuarioVendedor":1,"idPublicacion":1,"estado":"PENDIENTE","estadoStr":"PENDIENTE","precio":"35000","createdAt":"2026-11-21T23:33:03.213239700Z","updatedAt":"2026-11-21T23:33:03.213239700Z"},"message":"Orden creada exitosamente"}
```
*(Verificada inmediatamente en tabla `ordenes`, `GET /v1/orders/{id}` y `GET /v1/orders/mis-compras`.)*

2. **Aceptación por el vendedor (`PATCH /v1/orders/36`, HTTP `200 OK`):**
```json
{"order":{"idOrden":36,"idUsuarioComprador":2,"idUsuarioVendedor":1,"idPublicacion":1,"estado":"ACEPTADA","estadoStr":"ACEPTADA","precio":"35000","createdAt":"2026-11-21T23:33:03.213239Z","updatedAt":"2026-11-21T23:33:03.312540100Z"},"message":"Estado de la orden actualizado exitosamente"}
```

3. **Finalización por el comprador vía alias (`PATCH /v1/ordenes/36`, HTTP `200 OK`):**
```json
{"order":{"idOrden":36,"idUsuarioComprador":2,"idUsuarioVendedor":1,"idPublicacion":1,"estado":"COMPLETADA","estadoStr":"COMPLETADA","precio":"35000","createdAt":"2026-11-21T23:33:03.213239Z","updatedAt":"2026-11-21T23:33:03.327550600Z"},"message":"Estado de la orden actualizado exitosamente"}
```

4. **Cancelación en caso separado (`ACEPTADA -> CANCELADA`, HTTP `200 OK`):**
```json
{"order":{"idOrden":38,"idUsuarioComprador":2,"idUsuarioVendedor":1,"idPublicacion":1,"estado":"CANCELADA","estadoStr":"CANCELADA","precio":"35000","createdAt":"2026-11-21T23:33:03.367193Z","updatedAt":"2026-11-21T23:33:03.377231400Z"},"message":"Estado de la orden actualizado exitosamente"}
```
*(También se verificó cancelación directa por el comprador desde `PENDIENTE -> CANCELADA` en orden separada `#37`, y la inmutabilidad posterior de `COMPLETADA` y `CANCELADA` con HTTP `400`.)*

5. **Caída real de Catálogo (`catalogGRPC.Stop()`, `POST /v1/orders`, HTTP `503 Service Unavailable`):**
```json
{"code":14,"message":"catálogo no disponible: Unavailable","details":[]}
```
*(Confirmado en PostgreSQL que el conteo total en `ordenes` no aumentó.)*

---

## 4. Pasos Reproducibles y Matriz Esperado vs Observado

### Pasos de ejecución local
```powershell
# 1. Levantar PostgreSQL real de Orders
docker compose --profile orders up -d postgres_orders

# 2. Validar sintaxis de Compose (con placeholders temporales en memoria si Media no está configurado)
docker compose --profile orders config --quiet

# 3. Exportar variables en memoria desde .env (sin imprimir secretos)
$pw = (Get-Content .env | Where-Object { $_ -match '^POSTGRES_PASSWORD_ORDERS=' } | Select-Object -First 1) -replace '^POSTGRES_PASSWORD_ORDERS=',''
$env:DB_HOST = "localhost"
$env:DB_PORT = "5437"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = $pw.Trim()
$env:DB_NAME = "orders_db"
$env:ORDERS_ENABLE_CREATION = "true"

# 4. Análisis estático, compilación y pruebas reales sobre PostgreSQL + IAM + Catálogo + HTTP/gRPC
cd backend-go
go vet ./...
go build ./...
go test -v -count=1 ./internal/api/orders/...
go test -v -count=1 -run "TestOrder|TestValidateCreateOrder|TestValidateOrder|TestCreateOrder|TestPatchOrder|TestListOrders|TestGetOrder|TestModelToProtoOrder|TestBuildListOrdersResponse|TestIAMIdentityContract" ./internal/service/...

# 5. Regresión del consumidor frontend
cd ..\frontend-marketplace
node --test src/store/useOrdersStore.test.cjs src/store/useOrderActionsStore.test.cjs src/services/ordersMutationService.test.cjs
```

### Matriz Esperado vs Observado

| Criterio de aceptación | Esperado | Observado |
| :--- | :--- | :--- |
| Publicación `OFERTA` activa crea orden `PENDIENTE` con comprador del JWT | Orden persistida en PostgreSQL con `idUsuarioComprador` del token, `idUsuarioVendedor` y `precio` reales de Catálogo. | HTTP `200 OK`, `estado: "PENDIENTE"`, `idUsuarioComprador: 2`, `idUsuarioVendedor: 1`, `precio: "35000"`, fila confirmada en `ordenes`, `GET /v1/orders/{id}` y `mis-compras`. |
| Manipulaciones, auto-compra, `DEMANDA`, `PAUSADO`, duplicados y caída de Catálogo se rechazan sin persistir | Rechazos coherentes y conteo de filas en `ordenes` intacto. | Vendedor/precio alterados (`400`), auto-compra `RN-21` (`400`), duplicado `RN-22` (`409`), `DEMANDA` (`400`), `PAUSADO` (`400`), inexistente (`404`), sin token (`401`) y caída real de Catálogo (`503`); conteo en `ordenes` invariable tras cada rechazo. |
| Acciones permitidas cambian BD; tercero y transición inválida rechazan conservando el registro | `PENDIENTE -> ACEPTADA` (solo vendedor), `ACEPTADA -> COMPLETADA` (comprador/vendedor), cancelación desde `PENDIENTE`/`ACEPTADA`, inmutabilidad de estados finales y bloqueo optimista `Where("estado = ?", ...)`. | Ciclo completo y cancelaciones persisten y actualizan `fecha_actualizacion`; tercero recibe `403`, comprador intentando aceptar recibe `403`, saltos/regresiones/estados finales reciben `400`, carrera simulada en `Before("gorm:update")` retorna `codes.Aborted`; BD conserva el estado previo en todos los rechazos. |

---

## 5. Desglose de Pruebas (Aprobadas / Fallidas / Omitidas)

- **`go vet ./...` y `go build ./...` (`backend-go`):** **PASS** (exit `0`).
- **`docker compose --profile orders config --quiet`:** **PASS** (exit `0`).
- **`go test -v -count=1 ./internal/api/orders/...`:** **9 suites / 31 casos y subcasos APROBADAS, 0 FALLIDAS, 0 OMITIDAS (`SKIP`)** (`2.357s`).
- **`go test -v -count=1 -run "TestOrder|...|TestIAMIdentityContract" ./internal/service/...`:** **37 suites principales APROBADAS** (incluyendo `TestCreateOrder_RejectsNonOferta_ALL150` y `TestPatchOrderStatus_OptimisticLockAndUpdatedAt`), **0 FALLIDAS, 0 OMITIDAS (`SKIP`)** (`7.581s`). *(El paquete `internal/service/media` reportó `[no tests to run]` debido al filtro `-run` dirigido a Orders/IAM).*
- **`node --test` en `frontend-marketplace` (`useOrdersStore`, `useOrderActionsStore`, `ordersMutationService`):** **39/39 APROBADAS, 0 FALLIDAS, 0 OMITIDAS** (`3541.29ms`).

### Limitaciones conocidas
1. La integración real de IAM + Catálogo + Orders se ejecutó mediante servidores gRPC y HTTP locales levantados contra `PostgreSQL 16.15` en contenedor Docker (`postgres_orders:5437`), no contra el clúster Kubernetes remoto ni construyendo imágenes Docker completas de `orders`/`catalog` en este turno.
2. En los manifiestos de Kubernetes ([backend-go/k8s/orders/deployment.yaml](file:///c:/Users/apini/OneDrive/Escritorio/Allin1_Taller_de_integracion_III/backend-go/k8s/orders/deployment.yaml)), el tag de imagen permanece con placeholder `TAG_A_DEFINIR` hasta publicar la imagen del servicio para despliegue con `@Am4ro-aaa`.
3. No se modificó `frontend-marketplace` ni se habilitó la contratación de `DEMANDA` (fuera de alcance del MVP).
