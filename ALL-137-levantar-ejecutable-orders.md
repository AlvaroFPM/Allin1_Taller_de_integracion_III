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
| `backend-go/cmd/orders/main.go` | **Entrypoint del microservicio:** valida estrictamente la variable de entorno `JWT_SECRET` al arrancar (fallando con error claro antes de abrir puertos ni conectar servicios), conecta PostgreSQL con `database.ConnectDB()`, ejecuta `AutoMigrate(&models.Orden{})`, inicializa listener TCP (`:50053`), arranca servidor gRPC con `UnaryAuthInterceptor`, registra router de Gateway (`:8084`) y configura middleware CORS para Next.js. Falla de forma visible ante error de BD o configuración (exit status 1, sin simular persistencia). |
| `backend-go/internal/service/order_service_server.go` | **Adaptador gRPC de OrderService:** implementa la interfaz `orderspb.OrderServiceServer` generada por protobuf. Adapta y expone las operaciones operativas (`PatchOrderStatus`, `ListMyPurchases`, `ListMySales`), extrayendo `user_id` desde el contexto JWT. Mantiene `CreateOrder` fuera del despliegue público retornando 501 (`codes.Unimplemented`) hasta validar los datos contra Catálogo (ALL-141), y registra `GetOrder` como 501 (`codes.Unimplemented`) para ALL-149. Mapea entidades `models.Orden` a mensajes `orderspb.Order` y calcula `PaginationMeta`. |
| `backend-go/internal/api/orders/router.go` | **Routers de transporte:** provee `RegisterGRPCRouter` (para registrar el servidor gRPC y `reflection`) y `RegisterGatewayRouter` (para registrar el handler de `grpc-gateway` hacia el endpoint gRPC). |
| `backend-go/internal/api/orders/router_test.go` | **Pruebas de router y gateway HTTP:** verifica el registro de routers y ejecuta llamadas HTTP reales (`httptest.Server`) sobre el gateway, comprobando que las peticiones alcanzan el interceptor gRPC y el servidor tanto sin token (401 Unauthorized) como con Bearer JWT válido (POST a `/v1/orders` devuelve 501 pendiente ALL-141, GET `/v1/orders/{id}` devuelve 501 pendiente ALL-149, y PATCH/GET listados alcanzan el servicio). |
| `backend-go/internal/service/order_service_server_test.go` | **Pruebas unitarias del adaptador gRPC:** valida peticiones nil, contextos sin autenticar, registro formal de `CreateOrder` como `Unimplemented` (ALL-141) y `GetOrder` como `Unimplemented` (ALL-149), validación de transiciones, mapeo a protobuf y cálculo de paginación. |
| `backend-go/internal/service/order_service.go` | **Guarda de disponibilidad de BD:** se añadieron guardas defensivas `if s.db == nil` para retornar `codes.Unavailable` ordenadamente en lugar de causar panics por puntero nulo cuando no hay base de datos conectada. |

---

## 3. Verificación de Criterios de Aceptación

### Criterio 1: `Dockerfile.orders` encuentra y compila `cmd/orders`
Se reprodujo la instrucción exacta de compilación estática de la etapa builder de `Dockerfile.orders`:
```powershell
CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o orders_linux ./cmd/orders
```
- **Resultado:** **EXIT CODE 0**. El compilador encuentra `./cmd/orders`, resuelve todas las dependencias internas y genera el binario estático para Linux sin errores ni advertencias.

### Criterio 2: Proceso arranca y una llamada HTTP alcanza el servidor gRPC
Se diseñaron e integraron pruebas automatizadas de transporte en `internal/api/orders/router_test.go` que levantan el servidor gRPC con interceptor JWT y el servidor HTTP de gRPC-Gateway:
1. **Llamadas HTTP sin autorización:**
   - Petición: `GET /v1/orders/mis-compras` o `POST /v1/orders`
   - Resultado: HTTP `401 Unauthorized` generado por `middleware.UnaryAuthInterceptor()`.
2. **Llamada HTTP POST con token JWT válido:**
   - Petición: `POST /v1/orders` con token JWT válido.
   - Resultado: HTTP `501 Not Implemented` con mensaje `"operación CreateOrder no habilitada para despliegue público hasta validar datos contra Catálogo (pendiente ALL-141)"`. La petición HTTP atravesó gRPC-Gateway, fue autorizada por el interceptor JWT y alcanzó el método gRPC en `OrderServiceServer`.
3. **Llamada HTTP GET a orden específica con token JWT válido:**
   - Petición: `GET /v1/orders/1` con token JWT válido.
   - Resultado: HTTP `501 Not Implemented` con mensaje `"operación GetOrder no implementada en esta fase (registrada para sprint posterior ALL-149)"`.
4. **Llamada HTTP PATCH a estado de orden con token JWT válido:**
   - Petición: `PATCH /v1/orders/1` con body `{"nuevo_estado": "ACEPTADA"}` y token JWT válido.
   - Resultado: HTTP `503 Service Unavailable` confirmando que la petición atravesó el Gateway, superó la autenticación JWT y alcanzó la capa de servicio `OrderService` (al no tener BD conectada en el test unitario de transporte).

### Criterio 3: Inicio falla de forma visible ante configuración o BD inválida, sin simular persistencia
Se comprobaron dos escenarios críticos de arranque fallido:
1. **Falta de `JWT_SECRET` al iniciar Orders:**
   ```powershell
   $env:JWT_SECRET=""; go run ./cmd/orders
   ```
   - **Salida:**
     ```text
     Iniciando microservicio Orders (Órdenes)...
     2026/11/15 19:08:16 Error crítico de configuración: la variable de entorno JWT_SECRET es obligatoria para iniciar el microservicio Orders
     exit status 1
     ```
   - **Resultado:** Termina inmediatamente antes de abrir puertos ni conectar servicios. Evita que el interceptor use silenciosamente la clave de desarrollo en producción.
2. **Base de datos no disponible / configuración inválida:**
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
| `CreateOrder` | `POST /v1/orders`<br>`POST /v1/ordenes` | **Pendiente / Fuera de despliegue** | Registrada expresamente retornando `codes.Unimplemented` ("operación CreateOrder no habilitada para despliegue público hasta validar datos contra Catálogo (pendiente ALL-141)"). Evita persistir vendedor, publicación y precio no verificados. La lógica pura y persistencia en `OrderService` se conservan para su integración en ALL-141. |
| `PatchOrderStatus` | `PATCH /v1/orders/{id_orden}`<br>`PATCH /v1/ordenes/{id_orden}` | **Adaptada / Habilitada** | Extrae usuario desde JWT, valida pertenencia (comprador/vendedor), aplica FSM y actualiza estado en PostgreSQL con bloqueo optimista. |
| `ListMyPurchases` | `GET /v1/orders/mis-compras`<br>`GET /v1/ordenes/mis-compras` | **Adaptada / Habilitada** | Extrae comprador desde JWT, filtra por `id_usuario_comprador` y estado opcional, ordena DESC y retorna lista con `PaginationMeta`. |
| `ListMySales` | `GET /v1/orders/mis-ventas`<br>`GET /v1/ordenes/mis-ventas` | **Adaptada / Habilitada** | Extrae vendedor desde JWT, filtra por `id_usuario_vendedor` y estado opcional, ordena DESC y retorna lista con `PaginationMeta`. |
| `GetOrder` | `GET /v1/orders/{id_orden}`<br>`GET /v1/ordenes/{id_orden}` | **Pendiente** | Registrada expresamente retornando `codes.Unimplemented` ("operación GetOrder no implementada en esta fase (registrada para sprint posterior ALL-149)"). |

---

## 5. Resultados de Pruebas

- **Linteo y compilación:**
  - `go vet ./...` -> **PASS** (código 0).
  - `go build ./cmd/orders` -> **PASS** (código 0).
  - Compilación cruzada Linux (`CGO_ENABLED=0 GOOS=linux`) -> **PASS** (código 0).
- **Pruebas unitarias y de integración de transporte:**
  - `internal/api/orders`: 4 suites / 7 subcasos -> **100% PASS** (0.390s).
  - `internal/service` (adaptador + dominio puro): 12 suites / 50 subcasos puros -> **100% PASS** (0.333s).
  - Pruebas existentes de `OrderService` (ALL-126): 39 subcasos puros -> **100% PASS** sin regresiones.
