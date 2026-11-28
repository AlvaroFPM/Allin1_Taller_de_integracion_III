# ALL-141 — Validación de publicación, vendedor y precio al crear orden

## 1. Objetivo y punto de partida
- **Ticket:** ALL-141 (`[Sprint final S2] [Orders y Catálogo] Validar publicación, vendedor y precio al contratar`).
- **Rama de trabajo:** `feat/ALL-141-validar-publicacion-orden` (creada desde `develop` en `9edaad8`, incorporando `ALL-126`, `ALL-138` y `ALL-179`).
- **Archivos modificados:**
  - `backend-go/internal/service/order_service.go`
  - `backend-go/cmd/orders/main.go`
  - `backend-go/internal/service/order_service_test.go`
  - `backend-go/internal/service/order_service_server_test.go`
  - `backend-go/internal/ALL-141-validar-publicacion-orden.md`

---

## 2. Decisiones técnicas de integración

1. **Comunicación entre microservicios sin acceso cruzado a BD:**
   - Siguiendo el patrón *Database-per-Service*, `Orders` no consulta la tabla `publicaciones` ni importa lógica interna de `Catalog`[cite: 18].
   - Se definió la interfaz mínima `PublicationGetter` en `order_service.go` (satisfecha por `publicationpb.PublicationServiceClient`) invocando el RPC `GetPublication` con un timeout acotado de `3s` (`catalogCallTimeout`).

2. **Compatibilidad con constructor existente y fallo seguro (*fail-closed*):**
   - `NewOrderService(db *gorm.DB, catalogClient ...PublicationGetter)` recibe el cliente de Catálogo como parámetro variádico opcional para mantener compatibilidad con las llamadas puras existentes (`NewOrderService(nil)`).
   - En `CreateOrder`, `verifyPublication` corre después de `validateCreateOrder` (validaciones puras en memoria) y de la verificación `s.db == nil`, pero antes de la consulta de órdenes activas duplicadas (`RN-22`). Si `s.catalogClient == nil`, rechaza por defecto con `codes.Unavailable`.

3. **Criterio de rechazo ante datos manipulados y manejo de errores:**
   - **Publicación inexistente:** Si Catálogo retorna `codes.NotFound`, `Orders` propaga `codes.NotFound` (`HTTP 404`).
   - **Fallo de dependencia:** Ante cualquier otro error de red, timeout o respuesta sin publicación (`pub == nil`), `Orders` retorna `codes.Unavailable` (`HTTP 503`), distinguiendo caída de dependencia frente a publicación inexistente.
   - **Disponibilidad de la publicación:** Si `pub.GetEstado() != publicationpb.EstadoPublicacion_ACTIVO` (`PAUSADO`, `COMPLETADO`, `ELIMINADO`), retorna `codes.FailedPrecondition` (`HTTP 400`).
   - **Datos manipulados y autocontratación:** Si `vendedorID` o `precio` enviados por el cliente difieren de `pub.GetIdUsuarioVendedor()` o `pub.GetPrecioBase()`, se rechaza explícitamente con `codes.InvalidArgument` (`HTTP 400`) en lugar de sobrescribir silenciosamente. Además, se valida `compradorID != vendedorReal` (`RN-21`) contra el dueño real obtenido desde Catálogo.

4. **Configuración y coordinación con el equipo:**
   - `cmd/orders/main.go` lee la dirección gRPC desde `CATALOG_GRPC_ADDR` (con respaldo local `localhost:50052`) usando `grpc.NewClient` (conexión perezosa que permite arrancar `Orders` aunque `Catalog` esté caído y responder `Unavailable` al intentar contratar).
   - `order_service_server.go` no se modifica en este PR: la habilitación por defecto de `ORDERS_ENABLE_CREATION` y la inyección de `CATALOG_GRPC_ADDR` en `docker-compose.yml` / manifiestos de despliegue quedan registradas para coordinación con `@AlvaroFPM` y DevOps.

---

## 3. Pruebas automatizadas (`go test`)
Ejecutadas desde `backend-go/` con `-count=1` contra PostgreSQL local (`localhost:5434`):

```powershell
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
go test -v -count=1 ./internal/service/... -run "Order"