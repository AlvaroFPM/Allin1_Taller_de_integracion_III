# ALL-154 — Comprobar publicación y contratación con datos reales (Catálogo MVP)

- **Responsable:** Nicolás Fuentes
- **Presupuesto:** 2 puntos (2 horas). Es un límite de planificación, no acredita tiempo ejecutado.
- **Rama de trabajo:** `test/ALL-154-catalogo-publicacion-contratacion`
- **Versión candidata evaluada:** `develop` en `7e44a81` (incluye ALL-141, ALL-142, ALL-149, ALL-150 y ALL-143). Árbol de trabajo sin cambios en archivos versionados (`git status -s` solo muestra `.vscode/` y `backend-microservices/`, no versionados).
- **Fecha de ejecución:** 21-11-2026
- **Commit / PR:** [completar]
- **Revisión cruzada:** [nombre del revisor] — [enlace a su revisión]
- **Consumidores de esta entrega:** Álvaro (`@AlvaroFPM`) y Francisco (`@fbarriga2024`)

**Entorno:** Windows; PostgreSQL 16.15 (contenedor `postgres_catalog`, puerto 5434, base `catalog_db`); Go `go1.27.1 windows/amd64`. Catálogo y Orders se ejecutaron con `go run` desde el código de `7e44a81` (Catálogo: gRPC 50052 y HTTP 8082; Orders: gRPC 50053 y HTTP 8084, con `CATALOG_GRPC_ADDR=localhost:50052` y `ORDERS_ENABLE_CREATION=true`). Ambos usaron el mismo `JWT_SECRET` local de prueba.

---

## 1. Resumen

Se recorrió con datos reales, en una sola corrida, una publicación `OFERTA`: creación, listado, detalle y contratación en Orders, comparando ID, vendedor, precio, tipo y estado. Se probaron además vendedor manipulado, precio manipulado, publicación inexistente y publicación no activa (`PAUSADO`), verificando en PostgreSQL que ningún rechazo creó filas.

No se modificó código. No hubo desajustes que bloquearan el recorrido. Esta tarea no implementa contratación de `DEMANDA`, reseñas, pagos ni filtros nuevos.

## 2. Dependencias y alcance reutilizado

- **ALL-141** (validación de publicación, vendedor y precio en `CreateOrder`) y **ALL-142** (detalle y filtros) están fusionadas en `develop`. ALL-150 agregó en `verifyPublication` el rechazo explícito de publicaciones que no son `OFERTA`.
- No se duplicó la implementación de pruebas: se reutilizaron las existentes (sección 3) y la evidencia con IAM real de ALL-150.
- Detalle web: se revisó por inspección de código (sección 5). No se ejecutó el navegador en esta tarea.

## 3. Pruebas existentes reutilizadas

Desde `backend-go/`, con `DB_HOST=localhost`, `DB_PORT=5434`, `DB_NAME=catalog_db` y credenciales locales:

```powershell
go test -v -count=1 ./internal/service/... -run "TestCreateOrder_CatalogValidation_ALL141|TestGetPublication|TestListPublications"
```

| Prueba | Resultado |
| :--- | :--- |
| `TestCreateOrder_CatalogValidation_ALL141` (incluye inexistente, no activa, vendedor y precio alterados, RN-21 y caso nominal con transacción real) | PASS |
| `TestListPublications` | PASS |
| `TestGetPublication` | PASS |
| Paquete `internal/service` | `ok` en 2.515s |

Aprobadas: las 3 pruebas principales y todos sus subcasos. Fallidas: 0. Omitidas: 0 (no aparece ningún `SKIP`). El paquete `internal/service/media` informó `[no tests to run]` por el filtro `-run`.

Limitación: en `TestCreateOrder_CatalogValidation_ALL141` Catálogo se sustituye por un stub; la persistencia es real, pero la integración con Catálogo no se acredita con esa prueba. Esa integración se acredita con el recorrido de la sección 4.

## 4. Recorrido real: Catálogo + Orders + PostgreSQL

Se firmaron dos JWT HS256 con el `JWT_SECRET` compartido: vendedor `9101` y comprador `9102`. IAM no participó en esta corrida. Los ids 9101 y 9102 se eligieron fuera del rango del seed para poder limpiarlos.

### 4.1 Caso nominal

| Paso | Petición | Observado |
| :--- | :--- | :--- |
| Crear OFERTA | `POST :8082/v1/publications` con token 9101 | HTTP 200. `idPublicacion` 513, `idUsuarioVendedor` 9101, `tipoServicio` OFERTA, `precioBase` "25000", `estado` ACTIVO |
| Listar | `GET :8082/v1/publications?tipo_servicio=OFERTA&exclude_user_id=9102&limit=100` | La publicación 513 aparece con vendedor 9101, OFERTA, 25000, ACTIVO |
| Detalle | `GET :8082/v1/publications/513` | Mismo id, vendedor, tipo, precio y estado que en el listado |
| Contratar | `POST :8084/v1/orders` con token 9102 y `{id_usuario_vendedor: 9101, id_publicacion: 513, precio: "25000"}` | HTTP 200. Orden 221 `PENDIENTE`, comprador 9102, vendedor 9101, publicación 513, precio "25000" |

El vendedor 9101 de la respuesta de creación proviene del token: Catálogo sobrescribe el `id_usuario_vendedor` del body con el `user_id` del JWT.

### 4.2 Rechazos

| Caso | Entrada | HTTP | Código gRPC | Mensaje observado |
| :--- | :--- | :---: | :---: | :--- |
| Vendedor manipulado | `id_usuario_vendedor: 9999`, publicación 513, precio 25000 | 400 | 3 | el vendedor indicado no coincide con el de la publicación |
| Precio manipulado | vendedor 9101, publicación 513, `precio: "1000"` | 400 | 3 | el precio indicado no coincide con el de la publicación |
| Publicación inexistente | publicación 999999 | 404 | 5 | publicación no encontrada |
| Publicación no activa | publicación 514 puesta en `PAUSADO` con `UPDATE` directo | 400 | 9 | la publicación no está disponible para contratar |

Los mensajes de vendedor y precio hablan de discrepancia con Catálogo (no de campo obligatorio), lo que indica que el rechazo proviene de `verifyPublication` y no de la validación de entrada.

### 4.3 Persistencia (PostgreSQL, `catalog_db`)

Tras todos los rechazos, `SELECT ... FROM ordenes WHERE id_usuario_comprador = 9102` devolvió una sola fila: orden 221, comprador 9102, vendedor 9101, publicación 513, precio 25000, `PENDIENTE`. Ningún rechazo creó filas.

`SELECT ... FROM publicaciones WHERE id_usuario_vendedor = 9101` devolvió dos filas: 513 (`ACTIVO`) y 514 (`PAUSADO`).

### 4.4 Limpieza

Se borraron los datos de prueba (`DELETE 1` en `ordenes` y `DELETE 2` en `publicaciones`). Verificación posterior: 0 órdenes y 0 publicaciones de prueba, y `publicaciones` con 50 filas en total.

### 4.5 Corrida descartada

Una primera ejecución del script no sirve como evidencia. El `POST /v1/publications` respondió 400 (RN-11) porque el script no enviaba `id_usuario_vendedor` en el body, que `validateCreateRequest` exige aunque luego se sobrescriba con el token. Las llamadas posteriores a Orders recibieron vendedor y publicación en 0 y fallaron por validación de entrada, no por `verifyPublication`. No quedaron filas en `ordenes`. Se repitió con el body correcto (que es lo que envía el frontend).

## 5. Detalle web frente al contrato de Orders (inspección de código)

| Dato | Catálogo (JSON) | `publicationService.getPublicationById` | Envío a Orders (`publicaciones/[id]/page.tsx`) | Orders (`POST /v1/orders`) |
| :--- | :--- | :--- | :--- | :--- |
| ID de publicación | `idPublicacion` | `id` | `idPublicacion: state.publication.id` | `id_publicacion` |
| Vendedor | `idUsuarioVendedor` | `sellerId` | `idUsuarioVendedor: state.publication.sellerId` | `id_usuario_vendedor` |
| Precio | `precioBase` (string) | `price` (number) | `precio: String(state.publication.price)` | `precio` |

El mapeo es consistente. `orderService.createOrder` valida enteros positivos antes de enviar y la página rechaza precios que perderían precisión. El recorrido por HTTP de la sección 4 usó los mismos campos (con nombres snake_case, que el gateway acepta). No se ejecutó el navegador ni se capturó el payload real enviado por la pantalla. El bloqueo de `DEMANDA` en la interfaz se documenta en ALL-143 y no se revalidó aquí.

## 6. Criterios de aceptación

| Criterio | Estado | Evidencia |
| :--- | :--- | :--- |
| ID, vendedor, precio y disponibilidad coinciden entre detalle y validación de contratación | Cumplido en local | 4.1 (listado, detalle y orden 221 coinciden) y 5 |
| Recurso inexistente/no disponible y datos manipulados se rechazan de forma coherente | Cumplido en local | 4.2 y 4.3 |
| Existe evidencia de un caso nominal y uno de rechazo en la versión candidata | Cumplido en local | 4.1 y 4.2, sobre `7e44a81` |

## 7. Guía para Álvaro y Francisco

**Publicación OFERTA válida de ejemplo** (`POST /v1/publications`, con JWT del vendedor):

```json
{
  "id_usuario_vendedor": 9101,
  "categoria_id": 1,
  "titulo": "Tutoria Calculo I - Verificacion ALL-154",
  "descripcion": "Sesion individual de 60 minutos con material incluido para estudiantes universitarios",
  "tipo_servicio": "OFERTA",
  "precio_base": 25000,
  "ciudad": "Temuco",
  "region": "La Araucania"
}
```

Reglas que hay que respetar: título de al menos 5 caracteres, descripción de 50 a 1000 caracteres, precio entero mayor a 0, y `id_usuario_vendedor` presente en el body (el valor se reemplaza por el del token).

**Contratación válida** (`POST /v1/orders`, con JWT de un comprador distinto del vendedor): enviar los valores que devuelve el detalle de la publicación.

```json
{ "id_usuario_vendedor": 9101, "id_publicacion": 513, "precio": "25000" }
```

`idPublicacion` y el vendedor deben salir de `GET /v1/publications/{id}`; el precio se envía como entero positivo en string. Los ids 513 y 9101 son de esta corrida: no asumir que se repetirán.

**Rechazos observados en esta corrida:** tabla 4.2. Casos con evidencia en otras entregas, no ejecutados aquí: `DEMANDA` rechazada, autocontratación (RN-21), orden duplicada (RN-22) y petición sin token (ALL-150 y ALL-141), y caída de Catálogo con 503 (ALL-150).

**Verificar en la base tras un rechazo:**

```sql
SELECT id_orden, estado FROM ordenes
WHERE id_usuario_comprador = <ID_COMPRADOR> AND id_publicacion = <ID_PUBLICACION>
ORDER BY id_orden;
```

## 8. Hallazgos diferidos (sin corregir)

1. **`createdAt` de Catálogo desfasado:** en la creación, `createdAt` fue `2026-11-21T23:00:27Z` y `updatedAt` `2026-11-22T02:00:27Z`. La hora real era 02:00Z, por lo que `createdAt` parece llevar la hora local con sufijo `Z`. Orders no presenta el desfase (`02:01:42Z`). No se verificó cómo lo muestra el frontend.
2. **El detalle no filtra por estado:** `GET /v1/publications/514` respondió 200 con `estado: PAUSADO`. La disponibilidad se impone en Orders al contratar. Es coherente con el contrato actual.
3. **`id_usuario_vendedor` obligatorio en el body de creación** aunque Catálogo lo sobrescribe con el token (ya registrado en la lista B de ALL-129).
4. **`PAUSADO` no se puede producir por API** (`UpdatePublication` no está implementado), por lo que se forzó con un `UPDATE` directo.

## 9. Limitaciones

- Orders usó `catalog_db` en el puerto 5434, no `orders_db`.
- Los JWT se firmaron localmente; IAM real no participó.
- Se ejecutó con `go run` local; no se probó el clúster, las imágenes Docker ni el gateway Nginx.
- No se ejecutó el navegador: la comparación con el detalle web es por inspección de código.
- No se ejecutaron en esta corrida `DEMANDA`, RN-21, RN-22, petición sin token ni caída de Catálogo.
- La consola de PowerShell mostró acentos alterados (`Gasfiter├¡a`) por codificación (UTF-8 visto como CP850); el dato almacenado es correcto.
- No se conservaron archivos de evidencia. Los resultados provienen de la salida de consola pegada durante la sesión. No hay archivos adjuntos.
