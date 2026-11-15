# ALL-138 — [Sprint final S2] [Orders] Conectar Crear orden con el contrato y la identidad autenticada

- **Responsable:** Alvaro Pinilla
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `feat/ALL-138-orders-conectar-crear-orden`
- **Línea base:** `develop` en `2f04186` (con el PR #332 de ALL-137 integrado).
- **Fecha de ejecución:** 15-11-2026
- **Coordinación cruzada:** Verificación de vendedor, precio y publicación con Catálogo documentada para [ALL-141](https://linear.app/allin1/issue/ALL-141) (Nicolás Fuentes).

---

## 1. Objetivo y Alcance

Conectar la operación `CreateOrder` en el adaptador gRPC del microservicio Orders con el contrato oficial definido en `api/proto/orders.proto`, inyectando la identidad del comprador exclusivamente desde el token JWT validado en el contexto (`middleware.UserIDKey`), conservando el tipo `int64` para el precio y todas las reglas de negocio del dominio (`RN-21`, `RN-22`, `RN-23`), garantizando que tanto la ruta principal `POST /v1/orders` como su alias `POST /v1/ordenes` procesen la misma lógica de negocio.

---

## 2. Trabajo Realizado

1. **Adaptación de `CreateOrderRequest` a `CreateOrderResponse` en `order_service_server.go`:**
   - Se implementó el método `CreateOrder(ctx, req)` en el servidor gRPC `OrderServiceServer`.
   - Se valida la presencia de la petición (`req != nil`); en caso contrario se retorna `codes.InvalidArgument`.
   - Se extrae el `compradorID` usando `extractUserID(ctx)` directamente desde el contexto inyectado por `middleware.UnaryAuthInterceptor()`. Si no existe usuario en contexto, se retorna `codes.Unauthenticated` ("usuario no autenticado o token inválido").
   - Se extraen los parámetros `vendedorID`, `publicacionID` y `precio` (`int64`), preservando la precisión monetaria de 64 bits.
   - Se delega la ejecución en `OrderService.CreateOrder(ctx, compradorID, vendedorID, publicacionID, precio)`.
   - Se mapea la entidad `models.Orden` creada al mensaje `orders.Order` mediante `ModelToProtoOrder()`, incluyendo `IdOrden` autoincremental de la BD, `Estado` enum (`EstadoOrden_PENDIENTE`), `EstadoStr` (`"PENDIENTE"`), precio `int64` y timestamps.
   - Se retorna `orders.CreateOrderResponse` con la orden y mensaje descriptivo `"Orden creada exitosamente"`.

2. **Garantía de Identidad Autenticada y Prevención de Suplantación:**
   - El contrato `CreateOrderRequest` en `orders.proto` omite intencionalmente el campo `id_usuario_comprador` en el body para impedir que un cliente suplante a otro usuario.
   - La identidad del comprador proviene obligatoria y exclusivamente del claim `user_id` del token JWT verificado con la clave `JWT_SECRET`.

3. **Frontera de Coordinación con Catálogo (ALL-141 / Nicolás Fuentes):**
   - El servicio Orders valida de forma autónoma:
     - Campos obligatorios no nulos ni cero (`compradorID != 0`, `vendedorID != 0`, `publicacionID != 0`).
     - `RN-21`: Que el comprador no sea el mismo vendedor (prevención de auto-contratación).
     - `RN-22`: Que no exista ya una orden activa (en estado `PENDIENTE` o `ACEPTADA`) para esa publicación por el mismo comprador.
     - `RN-23`: Que el precio sea estrictamente mayor a cero.
   - La verificación cruzada vía cliente gRPC contra el microservicio Catálogo (para validar que la publicación exista en Catálogo, pertenezca al vendedor y coincida con el precio base oficial) queda acotada y coordinada para la tarea **ALL-141**, permitiendo cerrar la integración de identidad del contrato sin acoplar dependencias no finalizadas.

---

## 3. Verificación de Criterios de Aceptación

### Criterio 1: `POST /v1/orders` y su alias declarado (`POST /v1/ordenes`) llegan a la misma lógica
En `internal/api/orders/router_test.go` (`TestHTTPGateway_CreateOrder_EndpointsAndAlias`), se levantaron gRPC y gRPC-Gateway y se enviaron peticiones HTTP reales a ambas rutas:
- **Ruta `/v1/orders`:**
  - Rechaza auto-compra `comprador == vendedor` (RN-21) con HTTP `400 Bad Request` ("el comprador no puede ser el mismo vendedor (RN-21)").
  - Rechaza precio <= 0 (RN-23) con HTTP `400 Bad Request`.
  - Rechaza publicación en 0 con HTTP `400 Bad Request`.
  - Petición con datos válidos supera autenticación y validaciones (HTTP 503 por `db == nil` en test unitario puro).
- **Ruta `/v1/ordenes` (Alias):**
  - Rechaza auto-compra `comprador == vendedor` (RN-21) con HTTP `400 Bad Request`.
  - Rechaza precio <= 0 (RN-23) con HTTP `400 Bad Request`.
  - Rechaza publicación en 0 con HTTP `400 Bad Request`.
  - Petición con datos válidos supera autenticación y validaciones.
- **Resultado:** Ambos endpoints ejecutan exactamente la misma lógica de negocio y validación.

### Criterio 2: Comprador autenticado y orden persistida coinciden; respuesta incluye ID y estado válidos
En `internal/service/order_service_server_test.go` (`TestOrderServiceServer_CreateOrder_DBIntegration`):
- Se autenticó un contexto con `userID = 7`.
- Se envió `CreateOrderRequest` con `IdUsuarioVendedor: 3`, `IdPublicacion: 10`, `Precio: 25000`.
- **Comprobación:**
  - `resp.Order.IdUsuarioComprador == 7` (coincide exactamente con el comprador del token).
  - `resp.Order.IdUsuarioVendedor == 3`.
  - `resp.Order.IdPublicacion == 10`.
  - `resp.Order.Precio == 25000` (int64 preservado).
  - `resp.Order.Estado == orderspb.EstadoOrden_PENDIENTE`.
  - `resp.Order.IdOrden != 0` (ID autoincremental generado por la base de datos).
  - En la base de datos relacional, el registro persistido en la tabla `ordenes` tiene `id_usuario_comprador == 7` y `estado == 'PENDIENTE'`.

### Criterio 3: Sin token o con datos inválidos se rechaza y no se crea la orden
- **Sin token:** Peticiones HTTP a `/v1/orders` y `/v1/ordenes` sin cabecera `Authorization` son interceptadas por `middleware.UnaryAuthInterceptor()`, retornando HTTP `401 Unauthorized` (`codes.Unauthenticated`) antes de tocar el servicio o la BD.
- **Con datos inválidos:**
  - `compradorID == vendedorID` (`RN-21`): rechazo inmediato con `codes.InvalidArgument` (HTTP 400).
  - `precio <= 0` (`RN-23`): rechazo inmediato con `codes.InvalidArgument` (HTTP 400).
  - `vendedorID == 0` o `publicacionID == 0`: rechazo inmediato con `codes.InvalidArgument` (HTTP 400).
  - En todos los casos de rechazo, el flujo termina antes de la sentencia `db.Create()`, garantizando que ninguna orden se persista.

---

## 4. Resultados de Pruebas

- **Linteo y compilación:**
  - `go vet ./...` -> **PASS** (código 0).
  - `go build ./cmd/orders` -> **PASS** (código 0).
- **Pruebas de Router y Transporte HTTP Gateway (`internal/api/orders`):**
  - 4 suites / 14 subcasos -> **100% PASS** (0.367s).
- **Pruebas Unitarias y de Adaptador gRPC (`internal/service`):**
  - 12 suites / 56 subcasos puros -> **100% PASS** (0.375s).
  - Pruebas existentes de `OrderService` (ALL-126) y `OrderServiceServer` -> **100% PASS** sin regresiones.
