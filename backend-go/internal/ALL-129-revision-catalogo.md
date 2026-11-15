# ALL-129 — Revisión de responsabilidades y dependencias del código existente (Catálogo)

- **Responsable:** Nicolás
- **Presupuesto:** 1 punto (1 hora)
- **Línea base:** `develop` en `b3dc9ad`
- **Rama:** `refactor/129-catalog-revisar-responsabilidades-y-dependencias`
- **Entregable:** este documento. No se modifica ningún archivo de código en ALL-129.

Los números de línea corresponden a las copias analizadas de los archivos.

---

## 1. Alcance de la revisión

- **Análisis completo:** `backend-go/internal/service/publication_service.go` (207 líneas) y `backend-go/internal/service/mappers.go` (146 líneas).
- **Solo lectura, no se modifica:** `backend-go/internal/models/publication.go` (56 líneas). Motivos:
  - Los tags de GORM definen el esquema. `AutoMigrate` en `cmd/catalog/main.go` crea y altera `publicaciones` y `categorias` a partir de ellos, y la tarea prohíbe cambiar la persistencia.
  - Sus campos los usan `mappers.go`, `publication_service.go` y las pruebas.
  - Las consultas usan nombres de columna en strings (`"id_categoria = ?"`, `"estado = ?"`), por lo que un cambio fallaría en ejecución y no al compilar.
- **Consultados como contexto, sin proponer cambios en ellos:**
  - `publication_service_test.go`, para conocer qué comportamientos están cubiertos.
  - `cmd/catalog/main.go`, para ver cómo se instancia y registra el servicio.
  - `middleware/jwt_interceptor.go`, solo para saber cómo llega `UserIDKey` al contexto y qué rutas exigen token.
  - `frontend-marketplace/src/services/publicationService.ts`, para conocer los campos que consume el frontend.

---

## 2. Inventario por bloque

### A. Crear publicación — `CreatePublication` (`publication_service.go:26`)
- **Entrada:** `ctx` (puede traer `middleware.UserIDKey`) y `CreatePublicationRequest`.
- **Flujo:**
  1. `validateCreateRequest` (`mappers.go:15`).
  2. `protoTipoToModel` (`mappers.go:46`).
  3. Determina el usuario vendedor (L38–45): usa el del contexto; si no existe, usa `id_usuario_vendedor` del body.
  4. INSERT con GORM.
  5. Relee con `Preload("Categoria")` (L63, el error se ignora con `_ =`).
  6. `mapModelToProto`.
- **Salida:** `CreatePublicationResponse{Publication, Message}` o error gRPC (`InvalidArgument`, `Internal`).
- **Llamadores:** `POST /v1/publications` desde `createPublication` en `publicationService.ts` (usa el axios autenticado `api`). La ruta no es pública en `jwt_interceptor.go`: exige JWT válido.
- **Efecto persistente:** INSERT en `publicaciones` con estado `ACTIVO`. No se persiste `imagenes_urls` (el modelo no tiene esa columna).
- **Pruebas automáticas:** ninguna. `publication_service_test.go` no llama a `CreatePublication`.

### B. Detalle — `GetPublication` (`publication_service.go:72`)
- **Entrada:** `id_publicacion`. Si es 0 devuelve `InvalidArgument`.
- **Flujo:** `First` con `Preload("Categoria")`. Los registros con borrado lógico quedan excluidos porque el modelo tiene `gorm.DeletedAt` (`models/publication.go:48`), no por código explícito.
- **Salida:** `Publication` + `Vendedor` (`buildSellerSummary`), o `NotFound` / `Internal`.
- **Llamadores:** `GET /v1/publications/{id}`. Ruta pública con autenticación opcional. El frontend (`getPublicationById`) lee solo `publication` y no usa `vendedor`.
- **Efecto persistente:** ninguno.
- **Pruebas:** `TestGetPublication` (usa PostgreSQL real).

### C. Categorías — `GetCategories` (`publication_service.go:97`)
- **Entrada:** request vacío.
- **Flujo:** `Find` ordenado por `nombre ASC`, y `mapCategoriaToProto` por cada fila.
- **Salida:** `GetCategoriesResponse{Categories}`; la lista se construye con `make`.
- **Llamadores:** `GET /v1/categories` desde `getCategories` en `publicationService.ts`. Ruta pública.
- **Efecto persistente:** ninguno.
- **Pruebas automáticas:** ninguna.

### D. Listado, filtros y paginación — `ListPublications` (`publication_service.go:114`)
- **Entrada:** `page`, `limit`, `categoria_id`, `tipo_servicio`, `user_id`, `exclude_user_id`, `min_price`, `max_price`, y el `ctx`.
- **Reglas actuales (comportamiento a preservar):**
  - `page < 1` pasa a 1. `limit < 1` o `limit > 100` pasa a **10** (no se limita a 100) (L121).
  - Siempre filtra `estado = ACTIVO`.
  - `tipo_servicio` inválido o `UNSPECIFIED` no filtra y no da error (L141).
  - Si viene `user_id`, se filtra por ese vendedor y **no** se aplica la exclusión. Si no viene, se aplica RN-12: el usuario del token (si es mayor a 0) tiene prioridad sobre `exclude_user_id` (L154–157).
  - Precio mínimo y máximo inclusivos; un valor menor o igual a 0 se ignora; si min > max el resultado es vacío.
  - `Count` y luego `Find` con `Preload("Categoria")`, orden `fecha_creacion DESC, id_publicacion DESC` (L181), `Offset` y `Limit`.
  - Lista vacía devuelve `[]` (se construye con `make`).
- **Salida:** `ListPublicationsResponse{Publications, Meta{TotalRecords, CurrentPage, TotalPages, Limit}}`.
- **Llamadores:** `GET /v1/publications` desde `getPublications` (axios sin token).
- **Efecto persistente:** ninguno.
- **Pruebas:** `TestListPublications` (PostgreSQL real).

### E. Conversiones y validación — `mappers.go`
- `validateCreateRequest` (L15): 6 comprobaciones, en este orden: vendedor (RN-11), categoría, título (mínimo 5 runas, con `TrimSpace`), descripción (50 a 1000 runas, con `TrimSpace`), precio mayor a 0, tipo `OFERTA` o `DEMANDA`. Llamadores: `CreatePublication` y pruebas. Devuelve solo el primer error.
- `protoTipoToModel` (L46): llamadores: `CreatePublication`, `ListPublications` (ignora el error) y pruebas.
- `modelTipoToProto` (L58): llamador `mapModelToProto` y pruebas.
- `modelEstadoToProto` (L70): llamador `mapModelToProto` y pruebas.
- `mapModelToProto` (L86): llamadores `CreatePublication`, `GetPublication`, `ListPublications`. Incluye `Categoria` solo si `IDCategoria != 0`. No rellena `imagenes_urls`.
- `mapCategoriaToProto` (L110): llamadores `mapModelToProto` y `GetCategories`.
- `buildSellerSummary` (L135): llamadores `GetPublication` y pruebas (incluido el caso `nil`).
- Los llamadores listados corresponden a los archivos revisados.

---

## 3. Consumidores consultados

- `publication_service_test.go`: llama directamente a `validateCreateRequest`, `protoTipoToModel`, `modelTipoToProto`, `modelEstadoToProto`, `buildSellerSummary` y `NewPublicationServiceServer`, y usa `middleware.UserIDKey` y los campos del modelo. Un renombre de cualquiera de ellos rompe la compilación de las pruebas.
- `cmd/catalog/main.go`: instancia `NewPublicationServiceServer(db)`, registra el servicio y aplica `UnaryAuthInterceptor`.
- `middleware/jwt_interceptor.go`: `GetCategories`, `GetPublication` y `ListPublications` son rutas públicas con autenticación opcional; el resto (incluido `CreatePublication`) exige JWT, y el interceptor inyecta el `user_id` como `uint` en `UserIDKey`.
- `publicationService.ts`: lee `idPublicacion` o `id_publicacion`, `precioBase` o `precio_base`, `tipoServicio` o `tipo_servicio`, `idUsuarioVendedor`, `categoriaId`, `ciudad`, `region`, `categoria.nombre`, `categoria.slug`, `fechaCreacion` o `createdAt`, y `meta.totalRecords`, `meta.totalPages`, `meta.currentPage`.

---

## 4. Hallazgos y decisión

**H1. Normalización de paginación en `ListPublications` (L115–125).**
- El método normaliza `page` y `limit` con reglas propias: `limit` menor a 1 o mayor a 100 pasa a 10. La prueba existente "limit fuera de rango cae a 10 por defecto" (`limit: 500`) lo exige.
- Cambiar estas reglas alteraría el comportamiento visible.
- **Decisión: CONSERVAR.**

**H2. `userIDCtx.(uint)` sin comprobación (`publication_service.go:41`).**
- Hoy el interceptor siempre inyecta `uint`, así que la extracción no falla.
- Se mantiene la extracción actual por estabilidad durante esta semana. Queda anotado que la forma defensiva `id, ok := userIDCtx.(uint)` es la práctica recomendada en Go para evitar un `panic` ante un tipo inesperado.
- **Decisión: CONSERVAR esta semana.** Va a la lista B.

**H3. Fallback a `req.GetIdUsuarioVendedor()` (`publication_service.go:42–45`).**
- Por la vía real es inalcanzable: `CreatePublication` no es ruta pública y el interceptor rechaza peticiones sin JWT. No hay pruebas que lo ejerciten, pero llamar al servicio directamente (sin interceptor) sí lo usaría.
- **Decisión: CONSERVAR.** Quitarlo cambia el comportamiento. Va a la lista B.

**H4. Rama de error de `protoTipoToModel` en `CreatePublication`.**
- Tras `validateCreateRequest` el tipo siempre es válido, así que esa rama no se ejecuta en Create. La función sí es alcanzable desde `ListPublications` y tiene prueba para `UNSPECIFIED`.
- **Decisión: CONSERVAR.** Quitar el `if err != nil` obligaría a ignorar el error.

**H5. `if err == nil` al convertir `TipoServicio` en `ListPublications` (L141).**
- Un tipo inválido no filtra y no avisa.
- **Decisión: CONSERVAR.** Cambiarlo es un cambio de comportamiento. Va a la lista B.

**H6. `_ = ...Preload("Categoria")` en `CreatePublication` (L63).**
- Si la relectura falla, la respuesta sale sin categoría y sin error.
- **Decisión: CONSERVAR.** Va a la lista B.

**H7. `status.Errorf` con mensaje constante y sin argumentos en `GetPublication`** ("id de publicación inválido", "publicación no encontrada").
- Equivale a `status.Error` con el mismo código y mensaje.
- **Decisión: CANDIDATO A REFACTOR (neutral).** Mismo código gRPC y mismo mensaje.

**H8. Comentarios `FIX 1` / `FIX 2` en `ListPublications` (L127, y el de `make` al final).**
- Son etiquetas poco descriptivas: no dicen qué hace el código que acompañan.
- **Decisión: CANDIDATO A REFACTOR (solo comentarios).** Reescribirlos describiendo lo que hace cada bloque, sin etiquetas internas.

**H9. Nombres ambiguos en variables locales de `publication_service.go`.**
- `query` (`ListPublications`, L128–179, 10 usos): un solo nombre cubre a la vez el armado de filtros (GORM no consulta la base en `Where`) y lo que se ejecuta en `Count` (L174) y `Find` (L179). Es una variable local sin consumidores fuera de la función. Nombre a usar: `baseQuery`, consistente con las variables locales en inglés técnico del proyecto y con `order_service.go`. **CANDIDATO A REFACTOR.**
- `realUserID` (`CreatePublication`, L39–48): es el ID que se guarda en `IDUsuarioVendedor`; el nombre no dice que es el vendedor. **CANDIDATO A REFACTOR.**
- `tipoStr` (`CreatePublication` L32 y L52; `ListPublications` L140–142): nombra el tipo de dato y no su rol. **CANDIDATO A REFACTOR.**
- `protoList` (`ListPublications`, L194–200): no sigue el patrón de `protoCategories` (`GetCategories`). **CANDIDATO A REFACTOR.**
- `userIDCtx`: se conserva. El nombre es corto y claro para quien conoce el proyecto, porque el ID sale del `ctx`.
- Se conservan también `totalRecords`, `totalPages`, `excludeUserID` (coinciden con campos del contrato) y `protoCategories`.
- `IDUsuarioVendedor` frente a `CategoriaID` en el modelo: inconsistencia real, pero está en `models/publication.go` (solo lectura). **Descartado**, queda anotado.

**H10. `if pub == nil` en `buildSellerSummary` (`mappers.go`).**
- Tiene un consumidor: la prueba `pub nil retorna nil`.
- **Decisión: CONSERVAR.**

**H11. Datos que viajan sin uso aparente.**
- Campos en cero de `SellerSummary` (nombre, foto, métricas) e `imagenes_urls` en el `.proto`: son contrato público.
- **Decisión: CONSERVAR.**

---

## 5. Alcance acotado propuesto para ALL-130

Solo lo que no cambia comportamiento, contratos, persistencia ni crea funciones:

1. **H7:** reemplazar `status.Errorf` sin argumentos por `status.Error` en `GetPublication`.
2. **H8:** reescribir los comentarios `FIX 1` / `FIX 2` con texto descriptivo que no afirme nada sin verificar. El comentario de la L128 menciona `query`, así que se actualiza junto con el renombre.
3. **H9:** renombrar cuatro variables locales de `publication_service.go`, sin cambiar lógica:
   - `query` → `baseQuery` (`ListPublications`). Nombre técnico en inglés, consistente con las variables locales del proyecto y con `order_service.go`.
   - `realUserID` → `vendedorID` (`CreatePublication`)
   - `tipoStr` → `tipoServicio` (`CreatePublication` y `ListPublications`)
   - `protoList` → `protoPublications` (`ListPublications`)

   Se comprobó con `grep` que ninguno de los nombres nuevos está declarado a nivel de paquete en los archivos revisados.

**Condiciones:**
- Los renombres se hacen con la herramienta de renombre del editor (no buscar y reemplazar) y en un commit aparte, solo renombres, para que el revisor los verifique rápido.
- No renombrar funciones ni campos usados por las pruebas.
- No modificar la extracción de `userIDCtx` (L38–45): se mantiene por estabilidad en esta semana; la forma defensiva `id, ok :=` queda anotada en la lista B.
- No mover código entre archivos.
- No crear funciones, métodos ni endpoints.
- Conservar los saltos de línea CRLF para no ensuciar el diff.
- Si el alcance anterior resulta insuficiente, el resultado válido es "alcance mínimo". No se amplía con cambios que alteren comportamiento.

---

## 6. Comportamientos a preservar y comprobación antes/después

**Con prueba automática (PostgreSQL real, salvo indicación)**
- Mensajes y bordes de validación (`TestValidateCreateRequest`, sin base de datos).
- Conversión de enums (`TestMappers`, sin base de datos) y `buildSellerSummary` (`TestBuildSellerSummary_Pure`, sin base de datos).
- `page < 1` pasa a 1, `limit` fuera de rango pasa a 10, lista vacía devuelve `[]`.
- Filtros por categoría, tipo y precio (bordes inclusivos), solo `ACTIVO`, categoría precargada.
- RN-12: exclusión por token, prioridad del token y respaldo por `exclude_user_id`.
- `GetPublication`: id 0, inexistente, borrado lógico, vendedor sin email ni teléfono.

**Sin prueba automática: comprobación manual antes y después** (misma base sembrada, mismas peticiones, guardar las respuestas)
- `POST /v1/publications` con JWT válido: respuesta completa y registro en `publicaciones`.
- Orden del resultado de `GET /v1/publications` (`fecha_creacion DESC, id_publicacion DESC`).
- `GET /v1/publications?user_id=N` (no aplica exclusión).
- `GET /v1/publications?tipo_servicio=<valor inválido>` (se ignora, sin error).
- `GET /v1/categories` (orden alfabético).
- Orden y mensajes de validación con varios errores a la vez.
- Forma del JSON que lee el frontend: `precioBase`, `tipoServicio`, `categoria.nombre`, `meta.*`.

---

## 7. Defectos e integraciones pendientes (lista B, no se corrigen en esta semana)

1. `imagenes_urls` está en el `.proto` (RN-25) pero no se guarda ni se devuelve.
2. Fallback del `id_usuario_vendedor` del body (`publication_service.go:42–45`): inalcanzable por la vía real, sin prueba.
3. `userIDCtx.(uint)` sin `ok` (L41): no falla mientras el contexto traiga un `uint`, como ocurre hoy. La forma defensiva `id, ok := userIDCtx.(uint)` es la práctica recomendada en Go para evitar un `panic`; al aplicarla conviene definir qué ocurre cuando el valor no es `uint`.
4. Tipo de servicio inválido en el filtro de `ListPublications` se ignora en silencio.
5. Error del `Preload` ignorado en `CreatePublication`.
6. Validación: título y descripción se miden recortados pero se guardan sin recortar; no hay máximo para el título (la columna es `varchar(200)`); `ciudad` y `region` no se validan (la columna es `not null`, pero acepta cadena vacía).
7. `UpdatePublication` y `GetPublicationDetail` están declarados en el `.proto` (rutas `PUT`/`PATCH /v1/publications/{id}` y `GET .../detail`) pero no están implementados.
8. `SellerSummary` devuelve nombre, foto y métricas en cero: falta integrar IAM y reseñas (hay `TODO` en `mappers.go`).
9. Pruebas: faltan para `CreatePublication`, `GetCategories`, el orden del listado y el filtro `user_id`. Las pruebas de integración se saltan en CI si no hay PostgreSQL disponible (`CI` definido).
