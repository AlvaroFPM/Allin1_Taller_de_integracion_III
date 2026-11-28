# ALL-181: Comprobación de categorías y conversiones de datos consumidas por la interfaz

- **Tarea:** ALL-181 (`[Sprint final S2] [Catálogo] Comprobar categorías y conversiones de datos consumidas por la interfaz`)
- **Rama:** `test/181-catalog-categorias-conversiones`
- **Commit base evaluado (`develop`):** `9edaad8`
- **Dependencia previa:** ALL-142 (`backend-go/internal/ALL-142-detalle-filtros-integraciones.md`)
- **Entorno de validación:** Ejecución local contra microservicio Catálogo (`localhost:8082` HTTP / `localhost:50052` gRPC) y PostgreSQL (`postgres_catalog` / `catalog_db`), sin secretos expuestos y sin afirmar estado del clúster desplegado.

---

## 1. Alcance y relación con ALL-142

- **Reutilizado desde ALL-142:** Comprobación backend de `ListPublications` y `GetPublication` en PostgreSQL (`catalog_db`), precarga de `Categoria`, consistencia de `idUsuarioVendedor`, metadata de paginación y respuestas de error explícitas (`HTTP 400` y `HTTP 404`).
- **Aporte específico de ALL-181:**
  1. Verificación extremo a extremo de `GET /v1/categories` (`GetCategories` en `publication_service.go` y `mapCategoriaToProto` en `mappers.go`).
  2. Contraste campo por campo entre el contrato Protobuf (`api/proto/publication.proto`), la serialización real de `grpc-gateway` (`protojson`) y los adaptadores/tipos del frontend (`frontend-marketplace/src/services/publicationService.ts`, `src/types/publication.ts`, `src/lib/dateUtils.ts`).
  3. Caracterización automatizada en `frontend-marketplace/src/services/publicationService.contract.test.cjs` para los casos **nominal**, **opcional ausente** y **respuesta inválida**, sin alterar archivos compartidos (`publicationService.ts`, `.proto` ni `pb/`).

---

## 2. Tabla de comparación campo a campo (Backend vs. Frontend)

| Campo / Concepto | Base de datos (`catalog_db`) | JSON real (`grpc-gateway`) | Mapper TS (`publicationService.ts`) | Resultado en interfaz | Estado |
| --- | --- | --- | --- | --- | --- |
| **ID Categoría** (`GetCategories` y `categoria` anidada) | `id_categoria` (`1..10`) | `"idCategoria": 1` (number) | `Number(category.idCategoria ?? category.id_categoria ?? 0)` | `id: 1` (number) | Verificado en vivo (coincide en listado, FK `categoriaId` y `categoria.idCategoria`) |
| **ID Publicación** (`GetPublication` / `ListPublications`) | `id_publicacion` (`1..50`) | `"idPublicacion": 1` (number) | `Number(publication.idPublicacion ?? publication.id_publicacion ?? id)` | `id: 1` (number) | Verificado en vivo (si falta en detalle, usa el `id` de la URL como respaldo) |
| **ID Vendedor** | `id_usuario_vendedor` (`991`, `992`) | `"idUsuarioVendedor": 991` y `vendedor.idUsuario: 991` | `Number(publication.idUsuarioVendedor ?? ...)` (`vendedor` no se mapea) | `sellerId: 991` (`sellerName: undefined`) | Verificado en vivo (ID coherente; `vendedor` llega con ceros y TS lo ignora) |
| **Precio base (`int64`)** | `precio_base` (`25000` `bigint`) | `"precioBase": "25000"` (`string` por Proto3 JSON) | `Number(publication.precioBase ?? publication.precio_base ?? 0)` | `price: 25000` (number CLP) | Verificado en vivo en valores válidos (sin pérdida de precisión; texto no numérico da `NaN`) |
| **Tipo de publicación** | `tipo_servicio` (`OFERTA` / `DEMANDA`) | `"tipoServicio": "OFERTA"` / `"DEMANDA"` | `rawType === '2' \|\| rawType.toUpperCase() === 'DEMANDA' ? 'DEMANDA' : 'OFERTA'` | `'OFERTA'` o `'DEMANDA'` | Verificado en vivo (permisivo: cualquier valor desconocido cae a `'OFERTA'`) |
| **Icono de categoría** (opcional) | `icono_url` (`varchar(255)`, nullable) | `"iconoUrl": "https://placehold.co/..."` (omitido si es `NULL`) | `category.iconoUrl \|\| category.icono_url \|\| '📌'` | URL o `'📌'` | Verificado en vivo (con seed URL y con fila temporal `icono_url = NULL`) |
| **Categoría anidada** (opcional) | FK `id_categoria` (50/50 válidas en seed) | `"categoria": {"idCategoria": 1, "nombre": "Gasfitería", "slug": "gasfiteria", ...}` | `rawCat?.nombre \|\| 'General'`, `rawCat?.slug \|\| 'general'` | `'Gasfitería'` / `'gasfiteria'` | Verificado en vivo (fallback sintético `'General'` si falta el objeto `categoria`) |
| **Fechas (`Timestamp`)** | `fecha_creacion` (`timestamptz`) | `"createdAt": "2026-10-02T20:33:14.521Z"` (ISO 8601) | `formatRelativeTime(rawCreatedAt)` en `src/lib/dateUtils.ts` | Texto relativo en español | Verificado en vivo (`fechaCreacion` y `{seconds, nanos}` son ramas defensivas sin uso con este gateway) |
| **Total paginación (`int64`)** | `COUNT(*)` (`50` `bigint`) | `"meta": {"totalRecords": "50", "currentPage": 1, "totalPages": 25, "limit": 2}` | `Number(meta?.totalRecords ?? publications.length)` | `total: 50` (number) | Verificado en vivo |

---

## 3. Evidencia de ejecución por caso

### 3.1. Caso nominal (datos reales de `catalog_db`)

- **Integridad completa del seed en PostgreSQL:**
  - Consulta: `SELECT count(*) AS total, count(*) FILTER (WHERE c.id_categoria IS NULL) AS sin_categoria, count(*) FILTER (WHERE p.tipo_servicio NOT IN ('OFERTA','DEMANDA')) AS tipo_invalido, count(*) FILTER (WHERE p.precio_base <= 0) AS precio_invalido FROM publicaciones p LEFT JOIN categorias c ON c.id_categoria = p.id_categoria;`
  - Resultado: `total = 50`, `sin_categoria = 0`, `tipo_invalido = 0`, `precio_invalido = 0`.
- **`GET /v1/categories` (`HTTP 200`):** Devuelve las 10 categorías ordenadas alfabéticamente por `nombre`, con `idCategoria` numérico (`1..10`) e `iconoUrl` en UTF-8 íntegro (`"Gasfitería"`, `"Tecnología y electrónica"`).
- **`GET /v1/publications/1` (`HTTP 200`):**
  - `idPublicacion: 1`, `idUsuarioVendedor: 991`, `categoriaId: 1`, `tipoServicio: "OFERTA"`, `precioBase: "25000"`, `categoria.idCategoria: 1`, `categoria.nombre: "Gasfitería"`.
  - `publicationService.getPublicationById("1")` produce `id: 1`, `categoryId: 1`, `categoryName: "Gasfitería"`, `price: 25000` (`typeof === 'number'`), `type: "OFERTA"`.
- **`GET /v1/publications?limit=2` (`HTTP 200`):**
  - Publicaciones `50` (`tipoServicio: "DEMANDA"`, `precioBase: "20000"`, `categoriaId: 10`) y `49` (`tipoServicio: "OFERTA"`, `precioBase: "30000"`, `categoriaId: 10`), con `meta.totalRecords: "50"` convertido a `total: 50`.

### 3.2. Caso opcional ausente

- **`Category.icono_url = NULL` (verificado en vivo contra Catálogo local):**
  - Se insertó temporalmente `('TMP ALL181', 'tmp-all181', NULL)` en `categorias` (`id_categoria = 192`) y se eliminó inmediatamente después (`DELETE 1`).
  - Respuesta real de `GET /v1/categories`: `{"idCategoria":192,"nombre":"TMP ALL181","slug":"tmp-all181"}` (el campo `iconoUrl` se omite en JSON).
  - `publicationService.getCategories()` asigna el respaldo `icono: '📌'`.
- **`Publication.categoria` ausente (fixture sintético en test de caracterización):**
  - Como las 50 publicaciones del seed tienen categoría válida, se caracterizó mediante fixture sintético: cuando `categoria` no viene en el payload, `publicationService.ts` conserva `categoryId` numérico y asigna `categoryName: 'General'` y `categorySlug: 'general'`.

### 3.3. Caso respuesta inválida

- **Comportamiento del backend (`HTTP 400` / `HTTP 404` / `HTTP 401`):**
  - `GET /v1/publications/0` -> `HTTP 400` (`{"code":3,"message":"id de publicación inválido","details":[]}`).
  - `GET /v1/publications/abc` -> `HTTP 400` (`{"code":3,"message":"type mismatch, parameter: id_publicacion, error: strconv.ParseUint: parsing \"abc\": invalid syntax","details":[]}`).
  - `GET /v1/publications/999999` -> `HTTP 404` (`{"code":5,"message":"publicación no encontrada","details":[]}`).
  - `GET /v1/publications/1/detail` -> `HTTP 401` (`token de autorización no proporcionado`); además, el RPC `GetPublicationDetail` no está implementado en `internal/service` (el frontend consume `GET /v1/publications/{id}`).
- **Caracterización del mapper en frontend (`publicationService.contract.test.cjs`):**
  - Error de red o caída de Catálogo en `getCategories()` / `getPublications()` es capturado y retorna `[]` / `{ publications: [], total: 0 }`.
  - Respuesta vacía en `getPublicationById()` lanza `Error('Publicación no encontrada')`.
  - `tipoServicio: "TIPO_SERVICIO_UNSPECIFIED"` (o valor desconocido) se normaliza silenciosamente a `'OFERTA'`.
  - `precioBase: "abc"` (no numérico) produce `price: NaN` porque `Number("abc") ?? 0` evalúa a `NaN` (`NaN` no es `null` ni `undefined`).

---

## 4. Hallazgos, decisiones de alcance y pendientes replanificados

1. **Sin cambios en contrato ni archivos compartidos:** No se modificaron `api/proto/publication.proto`, los stubs generados en `internal/api/pb/`, `models/publication.go` ni `frontend-marketplace/src/services/publicationService.ts`, preservando compatibilidad con los consumidores existentes y evitando cambios no coordinados en código compartido de frontend.
2. **Constante estática `CATEGORIAS_DISPONIBLES` en `src/types/publication.ts`:** Contiene 13 categorías hardcodeadas cuyos IDs no coinciden con PostgreSQL (ej. `id: 1` es `'Flete & Mudanza'` en lugar de `'Gasfitería'`). Se verificó mediante búsqueda en todo `src/` que **ningún componente la importa**: el formulario de creación (`src/app/publicar/page.tsx:35`) consume `publicationService.getCategories()`. Se deja anotado para limpieza con el responsable de frontend.
3. **Conversiones permisivas en `publicationService.ts` (replanificado para coordinación frontend):**
   - `Number(p.precioBase ?? 0)` puede producir `NaN` si llega una cadena no numérica y convierte ausencia en `0` (violando `RN-23: precio > 0`).
   - `tipoServicio` desconocido se convierte silenciosamente en `'OFERTA'`.
   - `try/catch` en `getCategories()` y `getPublications()` retorna listas vacías indistinguibles de un catálogo sin registros.
   - `SellerSummary` (`vendedor`) llega con campos en cero desde Catálogo (sin integración con IAM en `GetPublication`) y el frontend lo ignora (`sellerName` queda `undefined`).
4. **Observaciones de infraestructura detectadas durante la revisión (fuera de alcance de ALL-181):**
   - En `backend-go/k8s/gateway/configmap.yaml`, la política CORS de `/v1/publications` declara `GET, POST, PUT, DELETE, OPTIONS` (sin `PATCH`).
   - En `backend-go/k8s/catalog/service.yaml`, el Service `catalog` expone únicamente el puerto `8082` (`http-gateway`) y no el `50052` (`grpc`), dato relevante para la coordinación de `CATALOG_GRPC_ADDR` en ALL-141.

---

## 5. Comandos de verificación ejecutados

```powershell
# Frontend: test de caracterización y linter
cd frontend-marketplace
node --test src/services/publicationService.contract.test.cjs
npx eslint src/services/publicationService.contract.test.cjs

# Backend: compilación y análisis estático
cd ../backend-go
go build ./...
go vet ./...