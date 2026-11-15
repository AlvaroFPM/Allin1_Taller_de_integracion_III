# ALL-137 — [Sprint final S2] [Orders] Levantar el ejecutable y registrar los servidores existentes

- **Responsable:** Alvaro Pinilla
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `feat/ALL-137-orders-levantar-ejecutable`
- **Línea base:** `develop` en `83118f3` (con refactors de Orders ALL-125, ALL-126 y ALL-173 integrados).
- **Fecha de ejecución:** 15-11-2026

---

## 1. Objetivo y Alcance

Poner en marcha el punto de entrada ejecutable del microservicio **Orders** (`cmd/orders/main.go`), conectar la base de datos PostgreSQL, ejecutar la migración de la tabla `ordenes`, registrar el servidor gRPC nativo con interceptor JWT y exponer los endpoints REST vía gRPC-Gateway con soporte CORS, siguiendo la arquitectura y patrones de los microservicios IAM y Catalog.

---

## 2. Componentes Implementados

| Archivo | Responsabilidad / Descripción |
| :--- | :--- |
| `backend-go/cmd/orders/main.go` | **Entrypoint del microservicio:** conecta PostgreSQL con `database.ConnectDB()`, ejecuta `AutoMigrate(&models.Orden{})`, inicializa listener TCP (`:50053`), arranca servidor gRPC con `UnaryAuthInterceptor`, registra router de Gateway (`:8084`) y configura middleware CORS para Next.js. Falla de forma visible ante error de BD o configuración (exit status 1, sin simular persistencia). |
| `backend-go/internal/service/order_service_server.go` | **Adaptador gRPC de OrderService:** implementa la interfaz `orderspb.OrderServiceServer` generada por protobuf. Adapta y delega las operaciones a la capa de dominio `OrderService`, extrayendo la identidad del usuario (`user_id`) desde el contexto JWT. Mapea entidades `models.Orden` a mensajes `orderspb.Order` (con enums y timestamps) y calcula `PaginationMeta`. Registra expresamente `GetOrder` como `codes.Unimplemented`. |
| `backend-go/internal/api/orders/router.go` | **Routers de transporte:** provee `RegisterGRPCRouter` (para registrar el servidor gRPC y `reflection`) y `RegisterGatewayRouter` (para registrar el handler de `grpc-gateway` hacia el endpoint gRPC). |
| `backend-go/internal/api/orders/router_test.go` | **Pruebas de router y gateway HTTP:** verifica el registro de routers y ejecuta llamadas HTTP reales (`httptest.Server`) sobre el gateway, comprobando que las peticiones alcanzan el interceptor gRPC y el servidor tanto sin token (401 Unauthorized) como con Bearer JWT válido (validación de RN-21 devolviendo 400 Bad Request, y 501 Not Implemented para GetOrder). |
| `backend-go/internal/service/order_service_server_test.go` | **Pruebas unitarias del adaptador gRPC:** 13 subcasos que validan peticiones nil, contextos sin autenticar, reglas de negocio puras (RN-21, RN-23), registro de `GetOrder` como `Unimplemented`, mapeo a protobuf y cálculo de paginación. |
| `backend-go/internal/service/order_service.go` | **Guarda de disponibilidad de BD:** se añadieron guardas defensivas `if s.db == nil` para retornar `codes.Unavailable` ordenadamente en lugar de causar panics por puntero nulo cuando no hay base de datos conectada. |

---

## 3. Verificación de Criterios de Aceptación

### Criterio 1: `Dockerfile.orders` encuentra y compila `cmd/orders`
Se reprodujo la instrucción exacta de compilación estática de la etapa builder de `Dockerfile.orders`:
```powershell
CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o orders_linux ./cmd/orders
```
- **Resultado:** **EXIT CODE 0**. El compilador encuentra `./cmd/orders`, resuelve todas las dependencias internas y genera el binario estático para Linux sin errores ni advertencias.

### Criterio 2: Proceso arranca con BD real y una llamada HTTP alcanza el servidor gRPC
Se diseñaron e integraron pruebas automatizadas de transporte en `internal/api/orders/router_test.go` que levantan el servidor gRPC con interceptor JWT y el servidor HTTP de gRPC-Gateway:
1. **Llamada HTTP sin autorización:**
   - Petición: `GET /v1/orders/mis-compras`
   - Resultado: HTTP `401 Unauthorized` generado por `middleware.UnaryAuthInterceptor()`.
2. **Llamada HTTP POST con token JWT válido:**
   - Petición: `POST /v1/orders` con `id_usuario_vendedor = 10` y JWT con `user_id = 10`.
   - Resultado: HTTP `400 Bad Request` con mensaje `"el comprador no puede ser el mismo vendedor (RN-21)"`. La petición HTTP atravesó gRPC-Gateway, fue autorizada por el interceptor JWT y ejecutó la regla de negocio gRPC en `OrderService`.
3. **Llamada HTTP GET a orden específica con token JWT válido:**
   - Petición: `GET /v1/orders/1`
   - Resultado: HTTP `501 Not Implemented` con mensaje `"operación GetOrder no implementada en esta fase (registrada para sprint posterior)"`.

### Criterio 3: Inicio falla de forma visible ante configuración o BD inválida, sin simular persistencia
Se comprobó la ejecución de `cmd/orders` configurando un host de base de datos inexistente:
```powershell
$env:DB_HOST="invalid-host-test"; $env:DB_PORT="9999"; go run ./cmd/orders
```
- **Salida:**
  ```text
  Iniciando microservicio Orders (Órdenes)...
  [error] failed to initialize database, got error failed to connect to `user=postgres database=postgres`: hostname resolving error: lookup invalid-host-test: no such host
  2026/11/15 18:46:57 Error crítico al conectar a la base de datos de Orders: error al conectar a la base de datos: ...
  exit status 1
  ```
- **Resultado:** El proceso falla de forma visible e inmediata terminando con código de salida 1 (`log.Fatalf`), sin levantar servidores de forma silenciosa ni simular persistencia en memoria.

---

## 4. Matriz de Operaciones gRPC (Adaptadas vs Pendientes)

| RPC en `orders.proto` | Endpoint REST Gateway | Estado | Implementación / Manejo |
| :--- | :--- | :---: | :--- |
| `CreateOrder` | `POST /v1/orders`<br>`POST /v1/ordenes` | **Adaptada** | Extrae comprador desde token JWT (`UserIDKey`), valida reglas RN-21, RN-22, RN-23, inserta orden PENDIENTE en PostgreSQL y retorna `orders.Order`. |
| `PatchOrderStatus` | `PATCH /v1/orders/{id_orden}`<br>`PATCH /v1/ordenes/{id_orden}` | **Adaptada** | Extrae usuario desde JWT, valida pertenencia (comprador/vendedor), aplica FSM y actualiza estado en PostgreSQL con bloqueo optimista. |
| `ListMyPurchases` | `GET /v1/orders/mis-compras`<br>`GET /v1/ordenes/mis-compras` | **Adaptada** | Extrae comprador desde JWT, filtra por `id_usuario_comprador` y estado opcional, ordena DESC y retorna lista con `PaginationMeta`. |
| `ListMySales` | `GET /v1/orders/mis-ventas`<br>`GET /v1/ordenes/mis-ventas` | **Adaptada** | Extrae vendedor desde JWT, filtra por `id_usuario_vendedor` y estado opcional, ordena DESC y retorna lista con `PaginationMeta`. |
| `GetOrder` | `GET /v1/orders/{id_orden}`<br>`GET /v1/ordenes/{id_orden}` | **Pendiente** | Registrada expresamente retornando `codes.Unimplemented` ("operación GetOrder no implementada en esta fase (registrada para sprint posterior)"). |

---

## 5. Resultados de Pruebas

- **Linteo y compilación:**
  - `go vet ./...` -> **PASS** (código 0).
  - `go build ./cmd/orders` -> **PASS** (código 0).
  - Compilación cruzada Linux (`CGO_ENABLED=0 GOOS=linux`) -> **PASS** (código 0).
- **Pruebas unitarias y de integración de transporte:**
  - `internal/api/orders`: 4 tests / 6 subcasos -> **100% PASS** (0.347s).
  - `internal/service` (adaptador + dominio puro): 12 suites / 52 subcasos puros -> **100% PASS** (0.331s).
  - Pruebas existentes de `OrderService` (ALL-126): 39 subcasos puros -> **100% PASS** sin regresiones.
