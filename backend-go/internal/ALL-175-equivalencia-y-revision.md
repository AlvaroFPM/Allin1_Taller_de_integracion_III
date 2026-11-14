# ALL-175 — Comprobación de equivalencia y revisión de cambios (Catálogo)

- **Responsable:** Nicolás
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `refactor/175-catalog-comprobar-equivalencia`
- **Base de comparación:** `develop` en `edd6010` (HEAD de la rama de trabajo)
- **Refactor evaluado:** ALL-130 — PR: [completar]
- **Fecha de ejecución:** 14-11-2026
- **Revisión cruzada:** [nombre del revisor] — [enlace a su revisión en el PR de ALL-130]

El refactor de ALL-130 aún no estaba fusionado, por lo que su versión de `publication_service.go` se importó a la copia de trabajo para ejecutar la comparación.

- **Antes:** `edd6010` con el `publication_service.go` original.
- **Después:** `edd6010` con el `publication_service.go` de ALL-130 importado.

---

## 1. Comprobaciones existentes

Comando ejecutado en ambas versiones, con PostgreSQL de pruebas (`postgres_catalog`, puerto 5434) y sin caché:

```
go test -v -count=1 ./internal/service/... -run "Publication|ValidateCreateRequest|Mappers|BuildSellerSummary"
```

| Grupo de pruebas | Subtests | Antes | Después |
| :--- | :---: | :---: | :---: |
| `TestValidateCreateRequest` | 16 | PASS | PASS |
| `TestMappers` | 3 | PASS | PASS |
| `TestListPublications` | 16 (más 10 anidados de rango de precio) | PASS | PASS |
| `TestBuildSellerSummary_Pure` | 2 | PASS | PASS |
| `TestGetPublication` | 5 | PASS | PASS |
| **Paquete `service`** | | `ok 1.856s` | `ok 1.728s` |

El servicio también compiló y arrancó en ambas versiones (`go run ./cmd/catalog/main.go`).

---

## 2. Comparación antes/después de los flujos HTTP

Con el servicio levantado sobre `catalog_db`, se ejecutaron las mismas 13 peticiones en cada versión (el seed informó datos existentes en ambas corridas).

**Criterio de "igual":** mismo código HTTP y mismo contenido JSON. Se ignoró `updatedAt`, porque el seed lo reescribe en cada arranque, y el espaciado entre campos del JSON, que difería entre compilaciones (por ejemplo `,` frente a `, `) sin cambiar el contenido.

| Flujo | Petición | Resultado |
| :--- | :--- | :--- |
| Listado base | `GET /v1/publications?page=1&limit=10` | Igual |
| Límite fuera de rango | `GET /v1/publications?limit=500` | Igual |
| Página 0 | `GET /v1/publications?page=0` | Igual |
| Filtro por categoría | `GET /v1/publications?categoria_id=1` | Igual |
| Filtro por tipo | `GET /v1/publications?tipo_servicio=OFERTA` | Igual |
| Tipo inválido | `GET /v1/publications?tipo_servicio=XYZ` | Igual: HTTP 400, rechazado por el gateway (`parsing field "tipo_servicio": "XYZ" is not a valid value`) |
| Rango de precio | `GET /v1/publications?min_price=10000&max_price=50000` | Igual |
| Filtro por vendedor | `GET /v1/publications?user_id=991` | Igual |
| Exclusión de usuario | `GET /v1/publications?exclude_user_id=991` | Igual |
| Detalle (flujo normal) | `GET /v1/publications/1` | Igual |
| Detalle, id 0 (error) | `GET /v1/publications/0` | Igual: HTTP 400, código 3, mensaje "id de publicación inválido" |
| Detalle, id inexistente (error) | `GET /v1/publications/999999` | Igual |
| Categorías | `GET /v1/categories` | Igual |
| Crear publicación | `POST /v1/publications` | No ejecutado: no tiene prueba automática ni captura manual. Solo se revisó el diff, que únicamente renombra variables en `CreatePublication`. |

---

## 3. Revisión del diff

**Alcance del diff.** `git diff --stat HEAD` muestra 1 archivo modificado, 24 inserciones y 28 eliminaciones: solo `backend-go/internal/service/publication_service.go`. No hay cambios en `mappers.go`, `models/publication.go`, el `.proto`, `pb/` ni en las pruebas.

**Cambios revisados**

1. **Renombres de variables locales** (sin cambios de lógica):
   - `query` → `baseQuery` en `ListPublications` (separa el armado de filtros de las ejecuciones de `Count` y `Find`).
   - `realUserID` → `vendedorID` en `CreatePublication`.
   - `tipoStr` → `tipoServicio` en `CreatePublication` y `ListPublications`.
   - `protoList` → `protoPublications` en `ListPublications`.
2. **`status.Errorf` → `status.Error`** en `GetPublication`, en los dos mensajes constantes ("id de publicación inválido" y "publicación no encontrada"). Mismo código gRPC y mismo mensaje; la respuesta del id 0 es idéntica antes y después.
3. **Comentarios `FIX 1` / `FIX 2`** reescritos como descripciones de lo que hace cada bloque.

**Observación a corregir en ALL-130**

4. Se eliminaron dos comentarios de `ListPublications` que la sección 5 del documento de ALL-129 no autorizaba:
   - `// RN-12: Excluir publicaciones del usuario en sesión del feed general (cuando no se filtra por usuario específico).` (rama `else` del filtro por vendedor)
   - `// Rango de precio (límites inclusivos). Como el precio base siempre es > 0 (RN-23),` (antes de los filtros de precio)

   Son solo comentarios, así que no afectan el comportamiento. Pero se pierde la referencia a RN-12 y RN-23, y el comentario de precio queda como un fragmento que empieza a mitad de frase ("un valor <= 0 se trata como..."). **Se deben restaurar en el PR de ALL-130**; esta tarea no modifica código.

**Confirmaciones**

- **No se añadieron funciones, métodos ni endpoints.** El diff no declara ninguna función nueva y no toca el `.proto` ni `pb/`.
- **No se eliminaron datos de las respuestas.** Los 13 flujos comparados son idénticos.
- **Parámetros sin uso:** `req` en `GetCategories` es preexistente y lo exige la interfaz generada; no se modifica.

---

## 4. Defectos funcionales diferidos

Se mantienen registrados en la lista B del documento de ALL-129 para las semanas siguientes. **No se corrigen ni se declaran resueltos por esta revisión.** Enlaces a las tareas: [completar].

1. `imagenes_urls` está en el `.proto` pero no se guarda ni se devuelve.
2. Fallback al `id_usuario_vendedor` del body en `CreatePublication`.
3. `userIDCtx.(uint)` sin comprobación `ok` en `CreatePublication`.
4. Tipo de servicio inválido en el filtro de `ListPublications` se ignora en silencio.
5. Error del `Preload` ignorado en `CreatePublication`.
6. Validaciones: título y descripción se guardan sin recortar, no hay máximo para el título y `ciudad` y `region` no se validan.
7. `UpdatePublication` y `GetPublicationDetail` están declarados en el `.proto` pero no implementados.
8. `SellerSummary` devuelve nombre, foto y métricas en cero (falta integrar IAM y reseñas).
9. Faltan pruebas para `CreatePublication`, `GetCategories`, el orden del listado y el filtro `user_id`.

---

## 5. Alcance alcanzado y limitaciones

**Alcanzado:** pruebas existentes antes y después, comparación de 13 flujos HTTP y revisión del diff con observaciones concretas.

**Limitaciones**

- **Crear publicación no se ejecutó** (sin prueba automática ni captura manual).
- **Revisión cruzada pendiente.** El nombre del revisor y el enlace a su revisión deben completarse cuando exista.
- **Las pruebas se ejecutaron con el filtro `-run`**: no se corrieron las demás pruebas del paquete ni de otros servicios.
- **La evidencia corresponde al archivo de ALL-130 importado** (sin merge). Restaurar los dos comentarios de la observación 4 no altera el comportamiento, por lo que no invalida la comparación.
- **Los archivos de evidencia** (`antes-*.txt`, `despues-*.txt`, `antes-tests.txt`, `despues-tests.txt`) se guardaron con la codificación por defecto de la consola, así que los acentos pueden verse alterados en ellos. Se adjuntan: [completar].
