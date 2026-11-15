# ALL-173 — Comprobación de equivalencia y revisión de cambios (Orders)

- **Responsable:** Alvaro Pinilla
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `refactor/ALL-173-orders-comprobar-equivalencia-y-revision`
- **Base de comparación:**
  - **Antes:** `develop` en `b3dc9ad` (línea base previa al refactor de Orders).
  - **Después:** `develop` en `83118f3` (con PR #324 / commit `f02806c` fusionado).
- **Refactor evaluado:** ALL-126 — PR #324 (`https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/324`)
- **Fecha de ejecución:** 15-11-2026
- **Revisión cruzada:** Nicolás Fuentes / Matías Briones — PR #324

---

## 1. Comprobaciones existentes y resultados comparativos

Comando ejecutado en ambas versiones (`backend-go`):

```powershell
go vet ./...
go build ./...
go test -v ./internal/service -run "TestValidateCreateOrder|TestCreateOrder|TestValidateOrderTransition|TestValidateOrderPermissions|TestPatchOrderStatus|TestOrder_NormalizePagination|TestValidateOrderFilterState|TestListOrders" -count=1
```

| Grupo de pruebas | Subcasos | Antes (`b3dc9ad`) | Después (`f02806c` / PR #324) | Estado |
| :--- | :---: | :---: | :---: | :---: |
| `TestValidateCreateOrder_PureValidation` | 7 | PASS | PASS | Idéntico |
| `TestValidateOrderTransition_PureValidation` | 9 | PASS | PASS | Idéntico |
| `TestValidateOrderPermissions_PureValidation` | 9 | PASS | PASS | Idéntico |
| `TestOrder_NormalizePagination_PureValidation` | 8 | PASS | PASS | Idéntico |
| `TestValidateOrderFilterState_PureValidation` | 6 | PASS | PASS | Idéntico |
| `TestListOrders_UserZero_ReturnsUnauthenticated_Pure` | 1 | PASS | PASS | Idéntico |
| `TestListOrders_InvalidState_ReturnsInvalidArgument_Pure` | 1 | PASS | PASS | Idéntico |
| **Total unitarios puros** | **39** | **7/7 PASS (0.412s)** | **7/7 PASS (0.447s)** | **Equivalente** |
| `TestCreateOrder_*` (3 tests con BD) | 3 | SKIP | SKIP | Sin PostgreSQL local (5434) |
| `TestPatchOrderStatus_*` (2 tests con BD) | 2 | SKIP | SKIP | Sin PostgreSQL local (5434) |
| `TestListOrders_*` (7 tests con BD) | 7 | SKIP | SKIP | Sin PostgreSQL local (5434) |
| **Total tests de integración con BD** | **12** | **12 SKIP** | **12 SKIP** | **Equivalente** |
| `go build ./...` | — | PASS (`BUILD_EXIT=0`) | PASS (`BUILD_EXIT=0`) | Idéntico |
| `go vet ./...` | — | PASS (`VET_EXIT=0`) | PASS (`VET_EXIT=0`) | Idéntico |
| Paquetes auxiliares (`internal/api/chat`, `internal/api/media`, `internal/middleware`) | — | PASS | PASS | Idéntico |

---

## 2. Comparación antes/después de los flujos funcionales

Se revisó la equivalencia de entradas, salidas y efectos para cada bloque del servicio:

### A. Creación de orden válida y rechazo de IDs/precio inválidos (`validateCreateOrder` / `CreateOrder`)

- **Flujo nominal (Creación válida):**
  - *Entrada:* `compradorID = 7`, `vendedorID = 3`, `publicacionID = 10`, `precio = 15000`.
  - *Antes:* `validateCreateOrder` retorna `nil`. `CreateOrder` verifica ausencia de orden activa duplicada (RN-22) e inserta registro en tabla `ordenes` con `estado = 'PENDIENTE'`.
  - *Después:* `validateCreateOrder` retorna `nil`. La lógica de verificación de duplicados y persistencia en `CreateOrder` se conservó intacta.
  - *Resultado:* **Idéntico**.
- **Flujo de error (Rechazo de datos inválidos):**
  - `compradorID = 0`: error gRPC `codes.InvalidArgument` ("el id del comprador es obligatorio").
  - `vendedorID = 0`: error gRPC `codes.InvalidArgument` ("el id del vendedor es obligatorio").
  - `publicacionID = 0`: error gRPC `codes.InvalidArgument` ("el id de la publicación es obligatorio").
  - `compradorID == vendedorID` (`5 == 5`): error gRPC `codes.InvalidArgument` ("el comprador no puede ser el mismo vendedor (RN-21)").
  - `precio <= 0` (`0` o `-5000`): error gRPC `codes.InvalidArgument` ("el precio debe ser un entero mayor a 0 (RN-23)").
  - *Resultado:* **Idéntico** (mismos códigos gRPC y textos de error).

### B. Transiciones de estado y permisos (`validateOrderTransition` / `validateOrderPermissions` / `PatchOrderStatus`)

- **Flujo nominal (Transiciones permitidas y permisos válidos):**
  - `PENDIENTE -> ACEPTADA`: Antes y Después **OK**.
  - `PENDIENTE -> CANCELADA`: Antes y Después **OK**.
  - `ACEPTADA -> COMPLETADA`: Antes y Después **OK**.
  - `ACEPTADA -> CANCELADA`: Antes y Después **OK**.
  - Permisos: Vendedor acepta (`OK`), Comprador o Vendedor completan (`OK`), Comprador o Vendedor cancelan (`OK`).
  - *Resultado:* **Idéntico**.
- **Flujo de error (Transiciones inválidas y permisos denegados):**
  - *Estado desconocido en el dominio (ej. `"ENVIADA"`):*
    - *Antes:* `switch` de 4 casos caía en `default` → `status.Errorf(codes.InvalidArgument, "estado de orden desconocido: %s", "ENVIADA")`.
    - *Después:* `_, ok := transicionesValidas["ENVIADA"]` (`ok == false`) → `status.Errorf(codes.InvalidArgument, "estado de orden desconocido: %s", "ENVIADA")`.
    - *Equivalencia:* **Idéntico** (mismo código `InvalidArgument` y texto exacto).
  - *Salto de etapa (`PENDIENTE -> COMPLETADA`):* `codes.FailedPrecondition` ("transición no permitida: no se puede pasar de PENDIENTE a COMPLETADA"). Idéntico.
  - *Regresión de estado (`ACEPTADA -> PENDIENTE`):* `codes.FailedPrecondition` ("transición no permitida: no se puede pasar de ACEPTADA a PENDIENTE"). Idéntico.
  - *Estados finales inmutables (`COMPLETADA -> CANCELADA`, `CANCELADA -> ACEPTADA`):* `codes.FailedPrecondition` ("transición no permitida..."). Idéntico.
  - *Permiso denegado:* Comprador intentando aceptar su propia orden → `codes.PermissionDenied` ("solo el vendedor puede aceptar la orden"). Tercero ajeno (ID `99`) → `codes.PermissionDenied` ("no tienes autorización para modificar esta orden"). Idéntico.

### C. Consultas por comprador / vendedor y normalización (`ListMyPurchases`, `ListMySales`, `listOrdersByUser`, `normalizePagination`)

- **Flujo nominal:**
  - Consulta con `columnaComprador` (`id_usuario_comprador`) vs `columnaVendedor` (`id_usuario_vendedor`): aísla estrictamente las órdenes del usuario según su rol.
  - *Total de registros == 0:*
    - *Antes:* Inicializaba `ordenes := make([]models.Orden, 0)`, saltaba la consulta `Find` y retornaba `ordenes, totalRecords, nil`.
    - *Después:* Evalúa `if totalRecords == 0` y retorna de forma anticipada `make([]models.Orden, 0), 0, nil`.
    - *Equivalencia:* **Idéntico**. En ambos casos se garantiza que el slice devuelto nunca sea `nil`, evitando excepciones de tipado (`TypeError`) en el cliente frontend.
  - *Normalización de paginación:* `page < 1 → 1`, `limit <= 0 → 10`, `limit > 100 → 100`, offset en 64 bits (`int(page - 1) * int(limit)`).
  - *Filtro por estado válido:* `"PENDIENTE"`, `"ACEPTADA"`, `"COMPLETADA"`, `"CANCELADA"` (incluyendo `" PENDIENTE "` con espacios, recortado con `TrimSpace`).
  - *Resultado:* **Idéntico**.
- **Flujo de error:**
  - `usuarioID == 0`: retorna `codes.Unauthenticated` ("usuario no autenticado o ID inválido").
  - *Filtro con estado inexistente (ej. `"ESTADO_DESCONOCIDO"` o `"ESTADO_INEXISTENTE"`):*
    - *Antes:* `switch` en `validateOrderFilterState` caía en `default` → `status.Errorf(codes.InvalidArgument, "estado de orden inválido: %s", estado)`.
    - *Después:* `_, ok := transicionesValidas[estado]` (`ok == false`) → `status.Errorf(codes.InvalidArgument, "estado de orden inválido: %s", estado)`.
    - *Equivalencia:* **Idéntico** (mismo código y texto).

---

## 3. Revisión del diff

**Alcance del diff.** `git diff b3dc9ad..PR#324` abarca 2 archivos modificados, 19 inserciones y 24 eliminaciones:
- `backend-go/internal/service/order_service.go` (+18, -23)
- `backend-go/internal/service/order_service_test.go` (+1, -1)

**Cambios revisados y confirmaciones:**

1. **Unificación de validación de estados del dominio:**
   - En `validateOrderTransition` y `validateOrderFilterState`, se eliminó la duplicación del `switch` de 4 casos a favor de la consulta directa al mapa `transicionesValidas`. Se preservaron intactos los mensajes de error diferenciados (`"estado de orden desconocido: %s"` vs `"estado de orden inválido: %s"`).
   - En `validateOrderTransition`, se sustituyó el bucle manual `for _, permitida := range destinosValidos` por `slices.Contains(destinosValidos, nuevoEstado)`.
2. **Retorno temprano en `listOrdersByUser`:**
   - La condición `if totalRecords == 0 { return make([]models.Orden, 0), 0, nil }` evita anidar la consulta `Find(&ordenes)` manteniendo la garantía de slice no-nil.
3. **Consumidores y firmas preservadas:**
   - Se verificó que `normalizePagination` conserva su firma de 3 retornos `(int32, int32, int)` porque `TestOrder_NormalizePagination_PureValidation` aserta explícitamente `gotPage`.
   - Se mantuvo la guarda `columna != columnaComprador && columna != columnaVendedor` como barrera contra inyecciones SQL en `Where(columna+" = ?", usuarioID)`.
   - Se comprobaron los consumidores en `frontend-marketplace` (`orders.ts`, `orderService.ts`, `ordersQueryService.ts`, `ordersMutationService.ts`, `useOrdersStore.ts`, `useOrderActionsStore.ts`): ningún contrato, endpoint ni campo público fue modificado.
4. **Comentario corregido en pruebas:**
   - En `order_service_test.go:21`, se corrigió el comentario `getEnvOrDefault` alineándolo con el identificador real `getOrderTestEnv`.
5. **Restricciones cumplidas:**
   - **No se añadieron funciones, métodos ni endpoints.**
   - **No se modificaron archivos generados `.pb.go`, `.proto` ni OpenAPI/Swagger.**
   - **No se alteró la persistencia ni las reglas de negocio (RN-21, RN-22, RN-23, FSM).**

---

## 4. Defectos funcionales diferidos (para semanas posteriores)

Se mantienen registrados los defectos e integraciones pendientes identificados en ALL-125 y ALL-126. **No se corrigen ni se declaran resueltos por esta revisión:**

1. **Microservicio Orders sin entrypoint ni router gRPC:** `cmd/orders` e `internal/api/orders` no existen en `b3dc9ad`/`develop` (aunque `Dockerfile.orders`, `docker-compose.yml`, `k8s/orders/` y `configmap.yaml` ya los referencian).
2. **Operación `GetOrder` sin implementación en servicio:** declarada en `orders.proto` y DTOs del frontend, pero ausente en `OrderService`.
3. **`PaginationMeta` incompleta:** `ListMyPurchases` y `ListMySales` no exponen metadatos de paginación (`total_pages`, `current_page`, `limit`) hacia gRPC.
4. **Falta de validación RPC con Catalog e IAM en `CreateOrder`:** no se verifica la existencia ni el precio real de la publicación, y el `compradorID` debe extraerse desde el contexto JWT (`middleware.UserIDKey`) en lugar de confiarse al cliente.
5. **Cancelación deshabilitada en frontend:** `ordersMutationService.ts` restringe acciones a `'ACEPTADA' | 'COMPLETADA'`, mientras que la FSM del backend soporta `'CANCELADA'`.
6. **Configuración de base de datos en pruebas:** `order_service_test.go` apunta por defecto a `localhost:5434` (`catalog_db`) en lugar de `postgres_orders` (`5437` / `orders_db`), omitiendo las 12 pruebas de BD cuando no hay contenedor local.

---

## 5. Alcance alcanzado y limitaciones

**Alcanzado:**
- Comprobación de compilación (`go build`) y linteo básico (`go vet`) con salida limpia en ambas versiones.
- Ejecución de 39 subcasos de pruebas unitarias puras antes y después con 100% PASS y tiempos consistentes (~0.4s).
- Verificación de equivalencia en flujos nominales y de error (creación, transiciones de estado, permisos, consultas y paginación).
- Revisión cruzada del diff de PR #324 confirmando ausencia de nuevas funciones o rotura de consumidores.

**Limitaciones:**
- Las 12 pruebas de integración con PostgreSQL quedaron en estado `SKIP` por falta de base de datos activa en `localhost:5434`.
- No se realizaron pruebas HTTP dinámicas de extremo a extremo debido a que el servicio `cmd/orders` no se encuentra aún implementado en la arquitectura.

