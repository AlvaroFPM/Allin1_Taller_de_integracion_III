# ALL-153 — Proteger órdenes activas duplicadas y comprobar conflictos (Orders)

- **Responsable:** Nicolás Fuentes
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `fix/ALL-153-orders-integridad-concurrencia`
- **Base de comparación:** `develop` en `9f81985`
- **Commit evaluado:** [completar]
- **PR:** [completar]
- **Fecha de ejecución:** 21-11-2026
- **Revisión cruzada:** [nombre del revisor] — [enlace a su revisión en el PR]
- **Consumidores de esta entrega:** ALL-186 (Amaro, despliegue de la candidata) y ALL-185 (Álvaro, validación del recorrido del MVP)

**Entorno de las pruebas:** Windows; Go 1.27.1; PostgreSQL 16.15 (contenedor `postgres_catalog`, imagen Alpine, puerto 5434, base `catalog_db`). Orders no tiene contenedor propio en el entorno local, por lo que las pruebas de Orders usan `catalog_db`. En las pruebas, Catálogo se sustituye por un stub: lo que se prueba es la persistencia en PostgreSQL, no la integración con Catálogo.

---

## 1. Resumen

`CreateOrder` comprobaba si existía una orden activa (`PENDIENTE` o `ACEPTADA`) del mismo comprador y publicación con un `Count` y después insertaba. Son dos pasos separados: dos solicitudes simultáneas pueden pasar el `Count` antes de que cualquiera inserte, y la regla RN-22 se rompe.

Se agregó una restricción atómica en PostgreSQL (índice único parcial) y el servicio traduce la violación de unicidad al mismo rechazo que ya devolvía el caso secuencial. La actualización por estado anterior de `PatchOrderStatus` ya existía y no se modificó: se comprobó con una prueba contra PostgreSQL real.

---

## 2. Archivos afectados

| Archivo | Cambio |
| :--- | :--- |
| `backend-go/internal/service/order_active_uniqueness.go` | Nuevo. `EnsureActiveOrderUniqueIndex` crea el índice de forma idempotente; `isUniqueConstraintViolation` detecta una violación de unicidad (SQLSTATE `23505`). |
| `backend-go/internal/service/order_service.go` | Constante `mensajeOrdenActivaDuplicada` usada en el rechazo del `Count` y en el del `Create`; el `Create` traduce la violación de unicidad a `codes.AlreadyExists`. |
| `backend-go/cmd/orders/main.go` | Llama a `EnsureActiveOrderUniqueIndex` justo después de `AutoMigrate`; si falla, el servicio no arranca. |
| `backend-go/internal/service/order_concurrency_integration_test.go` | Nuevo. Cuatro pruebas con conexión real a PostgreSQL, sin transacción envolvente. |
| `backend-go/internal/ALL-153-orders-integridad-concurrencia.md` | Este documento. |

No se modificaron `.proto`, `pb/`, `models/order.go`, el interceptor JWT, CORS, `docker-compose.yml` ni los manifiestos de Kubernetes.

---

## 3. Diseño

**Índice único parcial.**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_activa_unica
ON ordenes (id_usuario_comprador, id_publicacion)
WHERE estado IN ('PENDIENTE', 'ACEPTADA') AND deleted_at IS NULL;
```

- Solo cubre órdenes activas no eliminadas. Una orden `CANCELADA`, `COMPLETADA` o con borrado lógico queda fuera del índice y no impide contratar de nuevo.
- Su predicado coincide con el del `Count` previo: los estados salen de las mismas constantes del modelo (`models.EstadoOrdenPendiente`, `models.EstadoOrdenAceptada`) y el modelo tiene `DeletedAt`, por lo que GORM agrega `deleted_at IS NULL` al `Count`.
- Se creó con SQL explícito y no con una etiqueta de GORM en el modelo, para controlar el predicado exacto. No se evaluó la etiqueta; es una decisión de diseño, no un defecto comprobado de GORM.

**Se mantiene el `Count` previo.** Da el rechazo limpio en el caso secuencial. El índice es la defensa atómica para el caso concurrente.

**Un solo rechazo para ambos caminos.** El `Count` y el `Create` devuelven `codes.AlreadyExists` con el mismo mensaje (`mensajeOrdenActivaDuplicada`, que incluye "RN-22"). Un cliente no distingue si el rechazo vino de la comprobación previa o de la base.

**Detección del error.** `isUniqueConstraintViolation` acepta `gorm.ErrDuplicatedKey` (si la conexión tuviera `TranslateError`) o cualquier error que exponga `SQLState()` igual a `23505`. Las conexiones de las pruebas no activan `TranslateError`, así que lo que se ejercita ahí es la rama de `SQLState()`.

**Arranque.** Si existen órdenes activas duplicadas previas, la creación del índice falla y el servicio termina con `log.Fatalf` en lugar de arrancar sin la protección.

**`PatchOrderStatus`.** No se modificó. Actualiza con `WHERE estado = estadoAnterior` y devuelve `codes.Aborted` si `RowsAffected` es 0.

---

## 4. Evidencia ejecutada

Archivos de evidencia (en el escritorio, guardados con la codificación por defecto de la consola, así que los acentos pueden verse alterados): `antes-orders.txt`, `reproduccion-sin-indice.txt`, `despues-concurrencia.txt`, `estabilidad-concurrencia.txt`, `despues-orders-sin-indice.txt`, `despues-orders-v2.txt`. Se adjuntan: [completar].

Regla aplicada: una corrida solo cuenta como evidencia si las pruebas de base de datos aparecen como `PASS`. Un `SKIP` significa que no hubo conexión. Una corrida inicial con variables `DB_*` sin definir las dejó todas como `SKIP`; se descartó y se repitió con el entorno correcto.

### 4.1 Línea base (antes del cambio)

`develop` limpio en `9f81985`, sin el índice, comando `go test -v -count=1 ./internal/service/... -run "Order"`: **29 aprobadas, 0 fallidas, 0 omitidas**, paquete `service` en `ok`.

### 4.2 Reproducción del fallo (sin índice)

Prueba de registro `TestCreateOrder_ConcurrentWithoutUniqueIndex_RecordsPersistedDuplicates`: 5 rondas, 8 solicitudes simultáneas por ronda (mismo comprador y publicación, liberadas a la vez con un canal barrera), sin el índice.

| Ronda | Creaciones exitosas | Órdenes activas persistidas en PostgreSQL |
| :---: | :---: | :---: |
| 1 | 1 | 1 |
| 2 | 2 | 2 |
| 3 | 2 | 2 |
| 4 | 2 | 2 |
| 5 | 2 | 2 |

En 4 de 5 rondas quedaron dos órdenes activas equivalentes en la base. La carrera no es determinista y nunca pasaron más de 2 de las 8 solicitudes; no se investigó por qué. Esta prueba elimina el índice de la base, por lo que solo corre si se define `ORDERS_RECORD_RACE_WITHOUT_INDEX`.

### 4.3 Pruebas de regresión con el índice

Comando (desde `backend-go/`, con `DB_HOST=localhost`, `DB_PORT=5434`, `DB_NAME=catalog_db` y las credenciales de desarrollo local):

```powershell
go test -v -count=1 ./internal/service/... -run "ConcurrentSameBuyer|StaleState|AfterCancelledOrCompleted"
```

Salida (filtrada para mostrar resultados y la versión de PostgreSQL):

```text
    order_concurrency_integration_test.go:106: PostgreSQL: PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
--- PASS: TestCreateOrder_ConcurrentSameBuyerAndPublication_PersistsSingleActiveOrder (0.09s)
    order_concurrency_integration_test.go:183: PostgreSQL: PostgreSQL 16.15 ...
    order_concurrency_integration_test.go:184: PostgreSQL: PostgreSQL 16.15 ...
--- PASS: TestPatchOrderStatus_StaleStateDoesNotOverwriteConcurrentChange (0.11s)
    order_concurrency_integration_test.go:234: PostgreSQL: PostgreSQL 16.15 ...
--- PASS: TestCreateOrder_AfterCancelledOrCompletedOrder_AllowsNewActiveOrderWithIndexPresent (0.09s)
PASS
ok      .../backend-go/internal/service       0.378s
```

| Prueba | Qué verifica |
| :--- | :--- |
| `TestCreateOrder_ConcurrentSameBuyerAndPublication_PersistsSingleActiveOrder` | 8 solicitudes simultáneas: 1 creación, 7 rechazos `AlreadyExists` con el mensaje exacto de RN-22, ningún error interno y 1 sola fila activa persistida. |
| `TestPatchOrderStatus_StaleStateDoesNotOverwriteConcurrentChange` | Tras la lectura del servicio, otra conexión cancela la orden. El servicio devuelve `Aborted` y el estado persistido sigue siendo `CANCELADA`. |
| `TestCreateOrder_AfterCancelledOrCompletedOrder_AllowsNewActiveOrderWithIndexPresent` | Con el índice presente, una orden `CANCELADA` y una `COMPLETADA` no impiden crear una nueva; la nueva queda protegida (el siguiente intento recibe `AlreadyExists`) y las tres filas se conservan. |
| `TestCreateOrder_ConcurrentWithoutUniqueIndex_RecordsPersistedDuplicates` | Prueba de registro de 4.2; omitida por defecto. |

La lectura obsoleta de la segunda prueba se fuerza con un callback de GORM registrado solo en la prueba, para que el resultado sea determinista. En una carrera real entre dos `PATCH`, el que llega segundo puede leer el estado ya cambiado y recibir `FailedPrecondition` (transición no permitida) en lugar de `Aborted`; ambos rechazos conservan el estado ya aplicado.

### 4.4 Suite completa de Orders

Comando: `go test -v -count=1 ./internal/service/... -run "Order"`.

| Escenario | Aprobadas | Fallidas | Omitidas |
| :--- | :---: | :---: | :---: |
| Con el índice presente (incluye las 3 pruebas nuevas de regresión) | 32 | 0 | 1 (la prueba de registro, por diseño) |
| Sin el índice (`DROP INDEX` previo y `-skip` de las pruebas nuevas) | 29 | 0 | 0 |

Ninguna de las 29 pruebas existentes se rompe con el índice presente.

### 4.5 Estabilidad

`-count=20` sobre `ConcurrentSameBuyer|StaleState` (las dos pruebas de regresión existentes en ese momento): `ok`, sin fallos. La prueba de preservación de órdenes válidas se agregó después y no se repitió 20 veces.

### 4.6 Arranque real del servicio (`go run ./cmd/orders/main.go`, base `catalog_db`)

| Escenario | Resultado observado |
| :--- | :--- |
| Base sin el índice | Imprime la migración y `Índice de órdenes activas verificado.`; el índice queda creado (`\di` lo lista); gRPC en 50053 y REST en 8084. |
| Segundo arranque (índice ya creado) | Mismos mensajes, sin error: la creación es idempotente. |
| Dos órdenes activas duplicadas preexistentes (comprador 990301, publicación 990303, insertadas a mano) | El servicio no arranca: error `SQLSTATE 23505`, mensaje `no se pudo crear el índice idx_ordenes_activa_unica (revisa si existen órdenes activas duplicadas)`, `exit status 1`. No queda un índice parcial (`\di` no lo encuentra). |
| Tras borrar las 2 filas de prueba | Arranca normalmente y crea el índice. |

Consulta de duplicados activos sobre la base local antes de las pruebas: 0 filas.

---

## 5. Criterios de aceptación

| Criterio | Estado | Evidencia |
| :--- | :--- | :--- |
| Dos creaciones simultáneas no dejan dos órdenes activas equivalentes y el conflicto llega como rechazo explícito | Cumplido a nivel de servicio | 4.2 (el fallo existía) y 4.3 (con el índice, 1 fila activa y el resto `AlreadyExists` con el mensaje de RN-22). Los códigos HTTP no se ejecutaron (ver sección 7). |
| Una transición con estado obsoleto no sobrescribe el cambio ya aplicado | Cumplido a nivel de servicio | 4.3: `Aborted` y estado persistido intacto. |
| La prueba usa PostgreSQL real y registra resultado/versión; preserva órdenes válidas; contempla datos previos | Cumplido en el entorno local | PostgreSQL 16.15 registrado en el log; 4.3 (preservación con índice presente); 4.6 (duplicados previos detienen el arranque sin dejar el índice a medias). No se verificó la base real de Orders del despliegue. |

---

## 6. Revisión del diff

- **Alcance:** `git diff --stat` muestra `cmd/orders/main.go` (6 inserciones) y `internal/service/order_service.go` (9 inserciones, 3 eliminaciones) sobre archivos ya existentes, más los dos archivos nuevos del servicio.
- **Funciones nuevas:** `EnsureActiveOrderUniqueIndex` y `isUniqueConstraintViolation`, ambas necesarias para la protección pedida. No se agregaron endpoints ni se cambió ningún contrato.
- **Comportamiento visible:** el rechazo del `Count` conserva su código (`AlreadyExists`) y su mensaje; el mensaje pasó a una constante sin cambiar su texto.
- **Cambios de espacios en blanco no intencionales en `order_service.go`:** se quitó un espacio al final del comentario de `PatchOrderStatus` y se agregó el salto de línea al final del archivo. No afectan el comportamiento.
- **`gofmt -l`** marca casi todos los `.go` del repositorio por sus saltos de línea CRLF; es un hallazgo preexistente y no se corrigió. Los tres archivos de esta tarea se comprobaron con los saltos normalizados y no tienen diferencias.

---

## 7. Limitaciones y lo que no se ejecutó

- **No se ejecutó ninguna petición HTTP real** contra `POST /v1/orders`, `/v1/ordenes` ni `PATCH`. La evidencia es a nivel de servicio Go y de arranque. Los códigos HTTP de este documento son el mapeo por defecto de grpc-gateway (`AlreadyExists` y `Aborted` a 409, `FailedPrecondition` e `InvalidArgument` a 400, `NotFound` a 404, `PermissionDenied` a 403, `Unavailable` a 503), no una captura.
- **No se verificó la base real de Orders** que despliega Amaro, solo `catalog_db` local.
- **No se ejecutó el workflow de CI.** El workflow corre `go test -v ./...` con PostgreSQL 16 y `ORDERS_ENABLE_CREATION=true`; falta confirmar en su log que las pruebas nuevas aparezcan como `PASS` y no como `SKIP`.
- **Catálogo es un stub** en las pruebas (`newCatalogStub`): la persistencia es real, la integración con Catálogo no se acredita aquí.
- La prueba de registro hace `DROP INDEX` en la base; por eso solo corre con `ORDERS_RECORD_RACE_WITHOUT_INDEX`.
- Las pruebas usan comprador, vendedor y publicación con ids 990xxx y limpian sus filas con borrado definitivo; un id de demo en ese rango las afectaría.
- La carrera de 4.2 no es determinista: otra corrida puede dar valores distintos.
- No se verificó cómo `ConnectDB` abre la conexión en producción (si usa `TranslateError`); la detección cubre ambos casos.

---

## 8. Para Amaro (ALL-186)

1. **Antes de desplegar, sobre la base de Orders:**

```sql
SELECT id_usuario_comprador, id_publicacion, COUNT(*) AS duplicados
FROM ordenes
WHERE estado IN ('PENDIENTE', 'ACEPTADA')
  AND deleted_at IS NULL
GROUP BY id_usuario_comprador, id_publicacion
HAVING COUNT(*) > 1;
```

   - 0 filas: puede desplegarse.
   - Con filas: **no desplegar** hasta decidir con el equipo qué orden conservar. Resolverlo con una transición de estado legítima, no con un borrado masivo.
2. **El índice lo crea el propio servicio al arrancar**, tras `AutoMigrate`; no hay un paso de migración aparte. Se crea sin `CONCURRENTLY`, por lo que bloquea escrituras en `ordenes` mientras se construye (no se midió).
3. **Arranque correcto:** el log muestra `Migración exitosa: Tabla 'ordenes' sincronizada.`, `Índice de órdenes activas verificado.` y los dos mensajes de escucha (gRPC 50053, REST 8084).
4. **Arranque con duplicados:** el log muestra `Error crítico al crear el índice de órdenes activas ... (revisa si existen órdenes activas duplicadas)` y el proceso termina con código 1. Si la plataforma reinicia automáticamente los procesos caídos, es esperable que el servicio quede reiniciándose hasta resolver los duplicados (inferido, no observado).
5. **Variables de entorno que usa Orders:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`, `JWT_SECRET` (obligatoria), `GRPC_PORT` (por defecto 50053), `HTTP_PORT` (por defecto 8084), `ORDERS_ENABLE_CREATION` y `CATALOG_GRPC_ADDR`.
6. **Pendiente de despliegue, fuera del alcance de ALL-153:** se verificó que ni `docker-compose.yml` ni los manifiestos de `backend-go/k8s/orders/` contienen `ORDERS_ENABLE_CREATION` ni `CATALOG_GRPC_ADDR`. Sin `ORDERS_ENABLE_CREATION=true` la creación queda deshabilitada (`order_service_server.go`, línea 80; ALL-138 documenta la respuesta 501). El valor por defecto de `CATALOG_GRPC_ADDR` en `cmd/orders/main.go` es `localhost:50052`, que dentro de un contenedor no apunta a Catálogo. La dirección correcta de Catálogo en cada entorno no se verificó. Decidir cómo y dónde configurarlas corresponde a ALL-186; no se modificaron esos archivos.
7. **Reversión:** `DROP INDEX IF EXISTS idx_ordenes_activa_unica;` no pierde datos, pero la versión nueva de Orders vuelve a crear el índice en el siguiente arranque. Para revertir de forma efectiva hay que desplegar también la imagen anterior. Sin el índice, el `Count` previo sigue protegiendo las solicitudes secuenciales, no las simultáneas.
8. **Salud:** el estado de los probes y del rollout queda en ALL-186 (no se revisó en esta tarea).

---

## 9. Para Álvaro (ALL-185)

Rutas verificadas: creación en `POST /v1/orders` y `POST /v1/ordenes` (ALL-138); cambio de estado con las rutas `/v1/orders/{id_orden}` y `/v1/ordenes/{id_orden}` (`orders.pb.gw.go`). El método HTTP y el nombre del campo del cuerpo del cambio de estado, y las rutas de compras y ventas, deben confirmarse en `orders.proto` antes de ejecutar: [confirmar].

| Caso | Qué enviar | HTTP esperado | Código gRPC | Qué comprobar en la base |
| :--- | :--- | :--- | :--- | :--- |
| Primera orden válida | Comprador autenticado, vendedor y precio de la publicación | 200 | `OK` | Una fila en `PENDIENTE` |
| Contratación duplicada | Repetir la misma creación con la orden aún activa | 409 | `AlreadyExists` | Sigue habiendo una sola fila activa |
| Contratar de nuevo tras cancelar | Cancelar la orden y crear otra igual | 200 | `OK` | Fila anterior en `CANCELADA` y una nueva en `PENDIENTE` |
| Contratar de nuevo tras completar | Aceptar, completar y crear otra igual | 200 | `OK` | Fila anterior en `COMPLETADA` y una nueva en `PENDIENTE` |
| Vendedor manipulado | `id_usuario_vendedor` distinto al de la publicación | 400 | `InvalidArgument` | No se crea ninguna fila |
| Precio manipulado | `precio` distinto al de la publicación | 400 | `InvalidArgument` | No se crea ninguna fila |
| Comprador es el vendedor de la publicación (RN-21) | Token del vendedor | 400 | `InvalidArgument` | No se crea ninguna fila |
| Publicación inexistente | `id_publicacion` que no existe | 404 | `NotFound` | No se crea ninguna fila |
| Sin token | Sin cabecera de autorización | 401 | `Unauthenticated` | No se crea ninguna fila |
| Comprador intenta aceptar | Cambio a `ACEPTADA` con el token del comprador | 403 | `PermissionDenied` | El estado no cambia |
| Tercero modifica una orden ajena | Token de un usuario que no participa en la orden | 403 | `PermissionDenied` | El estado no cambia |
| Transición no permitida | Vendedor pide `ACEPTADA` sobre una orden `CANCELADA` | 400 | `FailedPrecondition` | El estado sigue `CANCELADA` |
| Orden inexistente | Cambio de estado sobre un id que no existe | 404 | `NotFound` | Sin cambios |

Los códigos HTTP son el mapeo por defecto de grpc-gateway, sin ejecución real (ver sección 7). El conflicto por estado obsoleto no se pide reproducir por HTTP: ya está probado a nivel de servicio (4.3) y, si ocurriera, llega como 409 (`Aborted`) o 400 (`FailedPrecondition`).

Tras cada rechazo, el estado persistido debe quedar igual que antes del intento:

```sql
SELECT id_orden, estado, fecha_actualizacion
FROM ordenes
WHERE id_usuario_comprador = <ID_COMPRADOR>
  AND id_publicacion = <ID_PUBLICACION>
ORDER BY id_orden DESC;
```