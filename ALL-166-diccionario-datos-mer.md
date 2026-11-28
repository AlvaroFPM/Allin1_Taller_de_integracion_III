# Diccionario de Datos y Actualización MER — Allin1 (ALL-166)

- **Tarea Linear:** ALL-166 (`[Sprint final S4] [Diagramas de datos] Actualizar MER y diccionario según modelos persistidos`)
- **Versión documental:** `v2.0` (actualización de los diagramas del Sprint 0)
- **Responsable:** Nicolás Fuentes
- **Fecha de verificación del esquema:** `2026-11-25` (revisión documental: `2026-11-27`)
- **Commit de referencia (`develop`):** `8299e08d2648fd677ddba33816fdd6f10bb9186d` (`8299e08`), contrastado contra el corte previo `9f81985` del `2026-11-20`
- **Entorno verificado:** Esquema generado sobre bases PostgreSQL 16 (`postgres:16-alpine`) creadas vacías en entorno local (`iam_db`, `catalog_db`, `orders_db`, `chat_db`, `media_db`) ejecutando los cinco ejecutables en `backend-go/cmd/*`
- **Entorno pendiente de verificación:** Esquema físico actual en el clúster Kubernetes (`student-aalarcon`) y confirmación final del entorno que se usará en la presentación del `2026-12-02`
- **Revisión cruzada:** `[Pendiente: indicar quién revisó los modelos y cuándo]`
- **Antecedentes históricos (Sprint 0):**
  - `Documentacion Sprint 0/Diagramas Allin1/Diagrama MER microservicios.drawio.png`
  - `Documentacion Sprint 0/Diagramas Allin1/Diagrama ms MER GENERAL.drawio.png`
  - `Explicación MER.pdf` (fechado el `2026-08-23`; no está en el repositorio al commit `8299e08`)
- **Entregables editables y exportados de esta versión:**
  - `Documentacion Sprint Final/Diagrama MER microservicios v2.drawio` (+ exportación `.png`)
  - `Documentacion Sprint Final/Diagrama ms MER GENERAL v2.drawio` (+ exportación `.png`)

---

## 1. Alcance y estado real de persistencia por microservicio

El sistema aplica el patrón **Database-per-Service** sobre PostgreSQL 16 con GORM (`AutoMigrate` en el arranque de cada microservicio). En el commit `8299e08`, el proyecto pasó del diseño inicial de 10–12 microservicios del Sprint 0 a **5 microservicios con 8 tablas efectivamente migradas**.

| Microservicio | Base de datos | Tablas migradas (`AutoMigrate`) | Implementado en código | Pruebas / evidencia (no ejecutadas en ALL-166) | Desplegado en K8s (`student-aalarcon`) | Pendiente / Observaciones |
|---|---|---|---|---|---|---|
| **IAM** | `iam_db` | `usuarios`, `perfiles` | Sí (`cmd/iam/main.go`) | Pruebas en el repo y evidencias `ALL-152`, `ALL-180`, `ALL-187` | Según `ALL-151` (22-11): 1/1 (manifiesto con tag `20261101-754d95d`, `postgres-iam`, enrutado en Gateway `/v1/auth`) | Verificar esquema físico actual en el pod `postgres-iam` del clúster y decidir sobre la ausencia de FK física en `perfiles` al migrar en limpio. |
| **Catálogo** | `catalog_db` | `categorias`, `publicaciones` | Sí (`cmd/catalog/main.go` + `seed.SeedIfEmpty`) | Evidencias `ALL-142`, `ALL-154`, `ALL-175`, `ALL-181`; script de carga k6 (`ALL-122`) | Según `ALL-151` (22-11): 1/1 (manifiesto con tag `20261101-754d95d`, `postgres-catalog` + HPA, Gateway `/v1/publications`, `/v1/categories`) | `UpdatePublication` y `GetPublicationDetail` del `.proto` no están implementados en `internal/service/`; `imagenes_urls` no se persiste. |
| **Orders** | `orders_db` | `ordenes` (+ índice único parcial `idx_ordenes_activa_unica`) | Sí (`cmd/orders/main.go`) | Pruebas en el repo y evidencias `ALL-141`, `ALL-143`, `ALL-150`, `ALL-153`, `ALL-154`, `ALL-155` | No figuraba en el clúster según `ALL-151` (22-11); solo manifiestos (`deployment.yaml` sigue con `TAG_A_DEFINIR`; cuenta con `configmap.yaml`, `service.yaml` y `postgres-orders.yaml`; rutas `/v1/orders` y `/v1/ordenes` en Gateway) | Build/tag inmutable, `orders-db-secret` y aplicación efectiva en clúster (o ejecución en Docker Compose `--profile orders`). |
| **Chat** | `chat_db` | `chat_salas`, `chat_mensajes` | Sí (`cmd/chat/main.go`) | Pruebas en el repo | Sin evidencia de despliegue (solo existen `deployment.yaml` con `TAG_A_DEFINIR` y `service.yaml`; ruta `/v1/chat` configurada en Gateway) | Faltan ConfigMap, Secret, `postgres-chat` y build de imagen para K8s; disponible localmente con `--profile chat`. |
| **Media** | `media_db` | `media` | Sí (`cmd/media/main.go`, REST sin gRPC) | Pruebas en el repo; `ALL-157`, `ALL-158`, `ALL-189` mencionados en `preparacion_media_s2.md` | No figuraba según `ALL-151` (solo existe `k8s/media/pvc.yaml`, sin StatefulSet, Deployment, Service ni ruta en Gateway Nginx) | Faltan manifiestos K8s y ruta en Gateway; disponible localmente con `--profile media` (puerto `8083`). |

> **Nota de honestidad sobre el entorno verificado:** Las tablas, columnas, tipos, restricciones e índices de este documento fueron verificados ejecutando los binarios compilados del commit `8299e08` contra bases PostgreSQL 16 vacías en entorno local (`2026-11-25`). No se inspeccionó la base de datos activa del clúster Kubernetes; cualquier tabla o restricción heredada de migraciones anteriores en el clúster deberá contrastarse antes de la defensa si se presenta en ese entorno. Entre `754d95d` (imagen indicada en los manifiestos de IAM y Catálogo) y `8299e08` no cambiaron sus modelos; sí cambió código de sus servicios. Esto no demuestra que el esquema vivo sea igual. El estado de despliegue proviene de `ALL-151-preflight-kubernetes.md` (commit `017a3c3`, 22-11) y no se volvió a verificar.

---

## 2. Diccionario de datos por microservicio

### 2.1. IAM (`iam_db`)

#### Tabla `usuarios` (`internal/models/usuario.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_usuario` | `bigint` (`uint`) | NO | `nextval('usuarios_id_usuario_seq')` | `PK` (`usuarios_pkey`) | Identificador único del usuario; propagado vía claim `user_id` en JWT. |
| `rut` | `varchar(20)` (`string`) | NO | — | `UNIQUE INDEX` (`idx_usuarios_rut`) | RUT único del usuario registrado. |
| `nombres` | `varchar(100)` (`string`) | NO | — | — | Nombres del usuario. |
| `apellidos` | `varchar(100)` (`string`) | NO | — | — | Apellidos del usuario. |
| `correo` | `varchar(150)` (`string`) | NO | — | `UNIQUE INDEX` (`idx_usuarios_correo`) | Correo único usado para autenticación (`Login`). |
| `password_hash` | `varchar(255)` (`string`) | NO | — | — | Contraseña encriptada con `bcrypt`. Nunca expuesta en API. |
| `rol` | `varchar(50)` (`string`) | SÍ | `'CLIENTE'` | — | Rol asignado al usuario. |
| `estado_activo` | `boolean` (`bool`) | SÍ | `true` | — | Indicador lógico de cuenta activa. |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de registro (`autoCreateTime`). |

#### Tabla `perfiles` (`internal/models/perfil.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_perfil` | `bigint` (`uint`) | NO | `nextval('perfiles_id_perfil_seq')` | `PK` (`perfiles_pkey`) | Identificador único del perfil complementario. |
| `id_usuario` | `bigint` (`uint`) | NO | — | `UNIQUE INDEX` (`idx_perfiles_id_usuario`). **Sin FK física creada en base vacía (`8299e08`)** pese al tag GORM (ver Sección 5). | Referencia 1 a 0..1 hacia `usuarios.id_usuario`. |
| `bio_experiencia` | `text` (`string`) | SÍ | — | — | Biografía o experiencia pública del usuario. |
| `telefono` | `varchar(20)` (`string`) | SÍ | — | — | Teléfono de contacto privado (excluido de `GetPublicProfile`). |
| `habilidades` | `text` (`string`) | SÍ | — | — | Lista textual de habilidades. |
| `ciudad` | `varchar(100)` (`string`) | SÍ | — | — | Ciudad del usuario. |
| `region` | `varchar(100)` (`string`) | SÍ | — | — | Región del usuario. |
| `foto_perfil_url` | `varchar(500)` (`string`) | SÍ | — | — | URL de avatar en Cloudinary (validada en `auth_service.go`). |
| `portada_url` | `varchar(500)` (`string`) | SÍ | — | — | URL de portada en Cloudinary (validada en `auth_service.go`). |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de creación del perfil. |
| `fecha_actualizado` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de última actualización. |

---

### 2.2. Catálogo (`catalog_db`)

#### Tabla `categorias` (`internal/models/publication.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_categoria` | `bigint` (`uint`) | NO | `nextval('categorias_id_categoria_seq')` | `PK` (`categorias_pkey`) | Identificador único de la categoría maestra. |
| `nombre` | `varchar(100)` (`string`) | NO | — | `UNIQUE` (`uni_categorias_nombre`) | Nombre visible de la categoría (10 categorías iniciales en `seed.go`). |
| `slug` | `varchar(120)` (`string`) | NO | — | `UNIQUE` (`uni_categorias_slug`) | Identificador legible para URL y siembra idempotente. |
| `icono_url` | `varchar(255)` (`*string`) | SÍ | — | — | URL opcional de ícono de categoría. |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de creación. |

#### Tabla `publicaciones` (`internal/models/publication.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_publicacion` | `bigint` (`uint`) | NO | `nextval('publicaciones_id_publicacion_seq')` | `PK` (`publicaciones_pkey`) | Identificador único de la publicación. |
| `id_usuario_vendedor` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_publicaciones_id_usuario_vendedor`), **ID lógico -> IAM** | Dueño de la publicación (tomado del JWT en `CreatePublication`; IDs `991..993` en seed demo). |
| `id_categoria` | `bigint` (`uint`) | NO | — | `FK FÍSICA` (`fk_publicaciones_categoria` -> `categorias(id_categoria)` `ON UPDATE CASCADE ON DELETE CASCADE`), `INDEX` (`idx_publicaciones_categoria_id`) | Categoría obligatoria de la publicación. |
| `titulo` | `varchar(200)` (`string`) | NO | — | — | Título del servicio o producto. |
| `descripcion` | `text` (`string`) | NO | — | — | Descripción detallada. |
| `tipo_servicio` | `varchar(50)` (`string`) | SÍ | `'OFERTA'` | — | Valores del dominio: `OFERTA`, `DEMANDA`. |
| `precio_base` | `bigint` (`int64`) | NO | — | — | Monto entero positivo en CLP (RN-23). |
| `ciudad` | `varchar(100)` (`string`) | NO | — | — | Ciudad de la publicación. |
| `region` | `varchar(100)` (`string`) | NO | — | — | Región de la publicación. |
| `estado` | `varchar(30)` (`string`) | SÍ | `'ACTIVO'` | — | Valores del dominio: `ACTIVO`, `PAUSADO`, `COMPLETADO`, `ELIMINADO`. |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de creación. |
| `fecha_actualizacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de actualización. |
| `deleted_at` | `timestamptz` (`gorm.DeletedAt`) | SÍ | — | `INDEX` (`idx_publicaciones_deleted_at`) | Borrado lógico (soft delete) administrado por GORM. |

---

### 2.3. Orders (`orders_db`)

#### Tabla `ordenes` (`internal/models/order.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_orden` | `bigint` (`uint`) | NO | `nextval('ordenes_id_orden_seq')` | `PK` (`ordenes_pkey`) | Identificador único de la orden de contratación. |
| `id_usuario_comprador` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_ordenes_id_usuario_comprador`), **ID lógico -> IAM** | Usuario autenticado (JWT) que solicita la contratación. |
| `id_usuario_vendedor` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_ordenes_id_usuario_vendedor`), **ID lógico -> IAM** | Vendedor contrastado contra la publicación real vía gRPC a Catálogo. |
| `id_publicacion` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_ordenes_id_publicacion`), **ID lógico -> Catálogo** | Publicación contratada (debe ser `OFERTA` y estar `ACTIVO`). |
| `estado` | `varchar(30)` (`string`) | NO | `'PENDIENTE'` | — | Estado FSM: `PENDIENTE`, `ACEPTADA`, `COMPLETADA`, `CANCELADA`. |
| `precio` | `bigint` (`int64`) | NO | — | — | Precio entero en CLP congelado al momento de crear la orden. |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de creación. |
| `fecha_actualizacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de última actualización. |
| `deleted_at` | `timestamptz` (`gorm.DeletedAt`) | SÍ | — | `INDEX` (`idx_ordenes_deleted_at`) | Borrado lógico (soft delete). |

**Índice único parcial aplicado en PostgreSQL (RN-22 / `ALL-153`):**
- `idx_ordenes_activa_unica`: `UNIQUE (id_usuario_comprador, id_publicacion) WHERE estado IN ('PENDIENTE', 'ACEPTADA') AND deleted_at IS NULL`. Garantiza concurrencia segura ante solicitudes duplicadas simultáneas.

---

### 2.4. Chat (`chat_db`)

#### Tabla `chat_salas` (`internal/models/chat.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_sala` | `bigint` (`uint`) | NO | `nextval('chat_salas_id_sala_seq')` | `PK` (`chat_salas_pkey`) | Identificador único de la conversación. |
| `comprador_id` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_chat_salas_comprador_id`), **ID lógico -> IAM** | Participante comprador (tomado del JWT al crear la sala). |
| `vendedor_id` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_chat_salas_vendedor_id`), **ID lógico -> IAM** | Participante vendedor. |
| `publicacion_id` | `bigint` (`*uint`) | SÍ | — | `INDEX` (`idx_chat_salas_publicacion_id`), **ID lógico opcional -> Catálogo** | Publicación asociada a la conversación, si aplica. |
| `created_at` | `timestamptz` (`time.Time`) | SÍ | — | — | Fecha de apertura de la sala. |
| `updated_at` | `timestamptz` (`time.Time`) | SÍ | — | — | Fecha de actualización de la sala. |
| `deleted_at` | `timestamptz` (`gorm.DeletedAt`) | SÍ | — | `INDEX` (`idx_chat_salas_deleted_at`) | Borrado lógico (soft delete). |

#### Tabla `chat_mensajes` (`internal/models/chat.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_mensaje` | `bigint` (`uint`) | NO | `nextval('chat_mensajes_id_mensaje_seq')` | `PK` (`chat_mensajes_pkey`) | Identificador único del mensaje. |
| `sala_id` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_chat_mensajes_sala_id`). **Sin FK física en PostgreSQL** (validada por aplicación). | Referencia a `chat_salas.id_sala`. |
| `remitente_id` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_chat_mensajes_remitente_id`), **ID lógico -> IAM** | Usuario autenticado que envía el mensaje. |
| `destinatario_id` | `bigint` (`uint`) | NO | — | `INDEX` (`idx_chat_mensajes_destinatario_id`), **ID lógico -> IAM** | Otro participante válido de la sala. |
| `contenido` | `text` (`string`) | NO | — | — | Cuerpo de texto del mensaje. |
| `leido` | `boolean` (`bool`) | NO | `false` | — | Estado de lectura del mensaje (`MarkAsRead`). |
| `created_at` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de envío. |
| `deleted_at` | `timestamptz` (`gorm.DeletedAt`) | SÍ | — | `INDEX` (`idx_chat_mensajes_deleted_at`) | Borrado lógico (soft delete). |

---

### 2.5. Media (`media_db`)

#### Tabla `media` (`internal/models/media.go`)

| Columna | Tipo PostgreSQL (Go) | Nulable | Default | Claves / Restricciones / Índices | Descripción |
|---|---|---|---|---|---|
| `id_media` | `bigint` (`uint`) | NO | `nextval('media_id_media_seq')` | `PK` (`media_pkey`) | Identificador único del registro multimedia. |
| `id_usuario` | `bigint` (`uint`) | NO | — | `INDEX` compuesto (`idx_media_usuario_tipo` sobre `id_usuario, tipo`), **ID lógico -> IAM** | Usuario autenticado que subió la imagen. |
| `tipo` | `varchar(20)` (`string`) | NO | — | Parte de `idx_media_usuario_tipo` | Valores permitidos en código: `PERFIL`, `PORTADA`. |
| `url` | `varchar(500)` (`string`) | NO | — | — | URL pública entregada por Cloudinary. |
| `public_id` | `varchar(255)` (`string`) | NO | — | `UNIQUE INDEX` (`idx_media_public_id`) | Identificador único del recurso en Cloudinary. |
| `fecha_creacion` | `timestamptz` (`time.Time`) | SÍ | — | — | Marca temporal de registro. |

*(Los structs `FileInfo` y `UploadResult` en `media.go` son DTOs de respuesta HTTP/JSON, no tablas persistidas).*

---

## 3. Mapa de relaciones comprobadas (FK física vs. relación lógica)

En las relaciones **sin FK física**, la cardinalidad es la esperada por la aplicación: PostgreSQL no garantiza que exista el registro referenciado. En las relaciones entre servicios se anota `0..1` en el lado referenciado. Ejemplo: el seed de Catálogo crea publicaciones con `id_usuario_vendedor` `991`–`993`, que no son usuarios registrados por IAM. Además, no hay restricciones `CHECK` en las 8 tablas: estados y `precio > 0` solo los controla la aplicación.

| Origen | Destino | Cardinalidad | Tipo real en `8299e08` | Mecanismo de validación |
|---|---|---|---|---|
| `categorias.id_categoria` | `publicaciones.id_categoria` | `1 : 0..N` (`\|\|--o{`) | **FK física aplicada en PostgreSQL** (`fk_publicaciones_categoria`, `ON UPDATE/DELETE CASCADE`) | Motor PostgreSQL (`catalog_db`). |
| `usuarios.id_usuario` | `perfiles.id_usuario` | `1 : 0..1` (`\|\|--o\|`) | **Relación interna sin FK física en base vacía (`8299e08`)** + `UNIQUE INDEX` | `auth_service.go` (`Register` no crea perfil; `UpdateProfile` hace upsert previa consulta del usuario; `GetProfile` tolera ausencia). Discrepancia registrada en Sección 5. |
| `chat_salas.id_sala` | `chat_mensajes.sala_id` | `1 : 0..N` (`\|\|--o{`) | **Relación interna sin FK física en PostgreSQL** (`INDEX` simple) | `chat_authorization.go` (`requireRoomParticipant` exige que la sala exista y que el usuario sea participante antes de insertar/leer). |
| `usuarios.id_usuario` (IAM) | `publicaciones.id_usuario_vendedor` (Catálogo) | `0..1 : 0..N` | **Relación lógica entre servicios** (sin FK) | Al crear, el vendedor se toma del JWT (el seed no pasa por esta validación); perfil público consultado por frontend a IAM en lectura (`ALL-187`). |
| `usuarios.id_usuario` (IAM) | `ordenes.id_usuario_comprador` y `id_usuario_vendedor` (Orders) | `0..1 : 0..N` | **Relación lógica entre servicios** (sin FK) | Comprador extraído del JWT; vendedor contrastado contra Catálogo vía gRPC (`ALL-141`). |
| `publicaciones.id_publicacion` (Catálogo) | `ordenes.id_publicacion` (Orders) | `0..1 : 0..N` | **Relación lógica entre servicios** (sin FK) | Llamada gRPC `PublicationService.GetPublication` desde Orders antes de persistir (`verifyPublication`). |
| `usuarios.id_usuario` (IAM) | `chat_salas.comprador_id` / `vendedor_id` y `chat_mensajes.remitente_id` / `destinatario_id` (Chat) | `0..1 : 0..N` | **Relación lógica entre servicios** (sin FK) | `comprador_id` y `remitente_id` salen del JWT; `destinatario_id` debe ser participante de la sala. `vendedor_id` lo envía el cliente y no se valida contra IAM. |
| `publicaciones.id_publicacion` (Catálogo) | `chat_salas.publicacion_id` (Chat) | `0..1 : 0..N` | **Relación lógica opcional entre servicios** (sin FK) | Campo `nullable` en `chat_salas`; sin validación gRPC hacia Catálogo. No hay restricción única de salas. |
| `usuarios.id_usuario` (IAM) | `media.id_usuario` (Media) | `0..1 : 0..N` | **Relación lógica entre servicios** (sin FK) | Middleware HTTP `JWT` (`middleware.HTTPAuth`); `media_service.go` inserta historial por cada subida. |

---

## 4. Decisiones de persistencia clave

1. **Identidad y desacoplamiento entre bases:**
   - `usuarios` y `perfiles` viven exclusivamente en `iam_db`. Ningún otro microservicio tiene tablas de usuarios ni claves foráneas hacia IAM.
   - Los servicios `catalog`, `orders`, `chat` y `media` comparten `JWT_SECRET` para validar el token localmente e inyectar `user_id` en el contexto para identificar al usuario autenticado. Esto no valida los demás ID que envía el cliente. `Login` no revisa `estado_activo`.
   - A diferencia del MER de agosto (`USUARIOS ||--|| PERFILES`), la cardinalidad comprobada en código es `1 : 0..1` (`||--o|`): `Register` solo crea el registro en `usuarios`, y `perfiles` se crea bajo demanda en `UpdateProfile`.
2. **Precio en `int64` (`bigint` en PostgreSQL):**
   - `publicaciones.precio_base` y `ordenes.precio` se persisten como `bigint` (`int64` en Go) para representar pesos chilenos (CLP) enteros positivos sin errores de redondeo de punto flotante (RN-23).
   - Al crear una orden, `Orders` consulta `GetPublication` vía gRPC a Catálogo y exige coincidencia exacta con `precio_base`, congelando el monto en `ordenes.precio` para preservar el historial aunque la publicación cambie después.
   - En la frontera HTTP REST (`grpc-gateway`), Protobuf serializa los campos `int64` como strings JSON (ej. `"precioBase": "30000"`), convención verificada en `ALL-181`.
3. **Estados y borrado lógico (`Soft Delete`):**
   - `publicaciones.estado`: `ACTIVO` (default), `PAUSADO`, `COMPLETADO`, `ELIMINADO`. `ListPublications` filtra `estado = 'ACTIVO'` además del `deleted_at IS NULL` implícito de GORM.
   - `ordenes.estado`: máquina de estados finita (FSM) estricta: `PENDIENTE -> ACEPTADA | CANCELADA`; `ACEPTADA -> COMPLETADA | CANCELADA`; `COMPLETADA` y `CANCELADA` son estados finales inmutables. Solo el vendedor puede pasar a `ACEPTADA`; ambas partes pueden cancelar o completar; las actualizaciones usan bloqueo optimista (`WHERE estado = estadoAnterior`).
   - `deleted_at` (`gorm.DeletedAt`) está indexado en `publicaciones`, `ordenes`, `chat_salas` y `chat_mensajes`. No existe soft delete en `usuarios`, `perfiles`, `categorias` ni `media`. El código actual no ejecuta borrados, por lo que el soft delete no está ejercitado. La FK de categorías usa `ON DELETE CASCADE`: borrar físicamente una categoría eliminaría sus publicaciones.
4. **URLs y persistencia multimedia:**
   - El servicio `Media` no guarda las imágenes en PostgreSQL ni como almacenamiento propio: las procesa, las sube a Cloudinary y guarda en `media_db.media` el historial de metadatos (`id_usuario`, `tipo`, `url`, `public_id`), creando un registro nuevo en cada subida (`1 : 0..N`). Si falla la escritura en BD tras subir a Cloudinary, el `public_id` queda en logs (limpieza diferida en `#173`).
   - IAM persiste únicamente las URLs vigentes `perfiles.foto_perfil_url` y `perfiles.portada_url` (`varchar(500)`), validando que pertenezcan al prefijo de Cloudinary configurado; si `foto_perfil_url` está vacía, `GetProfile` entrega una URL de avatar por defecto sin modificar la BD.
   - `categorias.icono_url` guarda una URL opcional (`varchar(255)`).
   - `publicaciones` **no persiste imágenes**: aunque `publication.proto` declara `repeated string imagenes_urls`, `publication.go` y `publication_service.go` no tienen columna ni tabla multimedia asociada.
5. **Campos de contrato `.proto` no persistidos (calculados o diferidos):**
   - En `chat.proto`, `ChatRoom.mensajes_no_leidos` se calcula en `ListRooms`; `ChatRoom.ultimo_mensaje` está declarado pero el código no lo completa. Ninguno es columna de `chat_salas`.
   - En `publication.proto`, `SellerSummary` devuelve `calificacion_promedio`, `total_resenas` y `trabajos_completados` en cero, y `email`/`telefono` vacíos (privacidad); el nombre público del vendedor se resuelve en el frontend contra `GET /v1/auth/profile/{user_id}` (`ALL-187`).
   - Los tipos de ID en `.proto` varían (`int64` en `auth.proto` vs. `uint32` en `publication.proto`, `orders.proto` y `chat.proto`), mientras que todas las claves PK/ID en PostgreSQL se persisten como `bigint`.

---

## 5. Discrepancias registradas para decisión (sin modificar código ni migrar)

1. **Ausencia de FK física en `iam_db.perfiles` sobre base vacía (`8299e08`):** `internal/models/perfil.go` declara `Usuario` con tag `foreignKey:IDUsuario;references:IDUsuario;constraint:OnUpdate:CASCADE,OnDelete:CASCADE`, pero al ejecutar `cmd/iam/main.go` sobre `iam_db` vacía (`postgres:16-alpine`), PostgreSQL solo creó `perfiles_pkey` e `idx_perfiles_id_usuario`, sin restricción `FOREIGN KEY`. Decisión pendiente: investigar por qué GORM omitió la restricción en `iam_db` y contrastar con el pod `postgres-iam` desplegado.
2. **Ausencia de FK física en `chat_db.chat_mensajes.sala_id`:** `ChatMensaje` no declara relación `foreignKey` GORM hacia `ChatSala`; la integridad recae exclusivamente en `chat_authorization.go`. Decisión pendiente: mantener validación en aplicación o añadir FK física en iteración futura.
3. **Modelo `internal/models/review.go` presente en repositorio sin servicio ni migración:** Define la tabla `resenas` con `CHECK (calificacion >= 1 AND calificacion <= 5)`, `CHECK (id_evaluador <> id_evaluado)` y `uniqueIndex (id_orden, id_evaluador)`, pero **ningún `cmd/*/main.go` ejecuta `AutoMigrate(&models.Resena{})`**. No forma parte de las tablas activas del MVP.
4. **RPCs declarados en `publication.proto` sin implementación:** `UpdatePublication` y `GetPublicationDetail` existen en el contrato `.proto`, pero no están implementados en `internal/service/publication_service.go`.
5. **Desalineación de despliegue en Kubernetes:** según `ALL-151` (22-11), IAM y Catálogo figuraban 1/1; Orders, su PostgreSQL y Media no figuraban, y la cuota del namespace no alcanzaba para Orders (faltaban al menos 50m de límite de CPU, 128Mi de solicitud y 512Mi de límite de RAM). Chat no tiene evidencia de despliegue. Falta decidir el entorno de la presentación.
6. **Referencias entre servicios no garantizadas:** el seed usa vendedores `991`–`993` inexistentes en IAM, y Chat no valida `vendedor_id` ni `publicacion_id`. Queda para decisión; no se modificó código.

---

## 6. Entidades y módulos planeados en Sprint 0 que NO se implementaron

Respecto a los diagramas del Sprint 0 (`Diagrama MER microservicios.drawio.png`, `Diagrama ms MER GENERAL.drawio.png`, `Explicación MER.pdf` y `Casos de uso principales.pdf`), quedaron fuera de la versión implementada:

- **En IAM:** `documentos_verificacion` (KYC), columna `kyc_verificado` en `usuarios` y columna `disponibilidad` en `perfiles`.
- **En Catálogo:** `multimedia_publicaciones`, `etiquetas`, `publicaciones_etiquetas`, `guardados_favoritos` y `portafolio_proveedor`.
- **En Órdenes / Pagos (CU-05 a CU-07):** `pagos_transacciones`, `custodia_escrow` y columnas `comision_plataforma` / `fecha_finalizacion` (el servicio actual gestiona solo `ordenes`, sin pasarela de pagos ni custodia; `ordenes` permite cancelar, pero no hay reembolso). Tampoco existe `id_reserva` (diagrama general antiguo).
- **Microservicios completos no implementados:**
  - **Reputación y Reseñas (CU-09):** `metricas_reputacion` y servicio activo de reseñas y `calificaciones_resenas` (solo existe el struct sin migrar `internal/models/review.go`, tabla `resenas`).
  - **Soporte y Disputas (CU-08):** `disputas`, `evidencias_disputa`, `reportes_usuarios`.
  - **Notificaciones (`notify`):** `notificaciones`, `dispositivos_push`, `preferencias_notificacion`.
  - **Geolocalización y Rutas (`geo`, CU-12):** `ubicaciones_registradas`, `zonas_cobertura`, `historial_tracking_orden`.
  - **Búsqueda y Descubrimiento (`search`, CU-12):** `historial_busquedas`, `sugerencias_populares`, motor Meilisearch/Elasticsearch. CU-12 está cubierto solo en parte: `ListPublications` tiene filtros; no hay geolocalización.
  - **Matchmaking y Recomendaciones (`match`, CU-14):** `interacciones_servicios`, `recomendaciones_log`, `preferencias_onboarding`.
  - **Publicidad (`Ads`, CU-15)** y **Agendamiento (`Booking`, CU-11):** campañas, métricas ads, disponibilidad horaria, reservas.
  - **Infraestructura asíncrona del Sprint 0:** bus de eventos RabbitMQ / Redis.
  - **Preguntas públicas sobre publicaciones (CU-10):** no implementadas.
- **Cambios de nombre y diferencias entre antecedentes:** `conversaciones`/`mensajes` pasaron a `chat_salas`/`chat_mensajes` y `ordenes_servicio` a `ordenes` (con columnas renombradas). `kyc_verificado` aparecía solo en el diagrama general y `disponibilidad` solo en el diagrama por microservicio.
- **Cambios de alcance agregados respecto al Sprint 0:** Se incorporó el microservicio **`Media`** (`media_db.media`) integrado con Cloudinary, más las columnas `perfiles.telefono`, `perfiles.portada_url`, `chat_salas.publicacion_id` y `chat_mensajes.destinatario_id`.

---

## 7. Registro de verificación y limitaciones (para cierre de ALL-166)

- **Pasos de comprobación ejecutados (`2026-11-25`):**
  1. Contraste de `git rev-parse HEAD` (`8299e08d2648fd677ddba33816fdd6f10bb9186d`) y `git log 9f81985..HEAD`.
  2. Revisión de modelos (`backend-go/internal/models/*.go`), entrypoints (`backend-go/cmd/*/main.go`), servicios (`auth_service.go`, `publication_service.go`, `order_service.go`, `chat_service.go`, `chat_authorization.go`, `media/media_service.go`, `seed.go`), contratos (`backend-go/api/proto/*.proto`) y manifiestos (`docker-compose.yml`, `backend-go/k8s/*`).
  3. Arranque de los 5 microservicios contra un contenedor PostgreSQL `16-alpine` temporal con 5 bases vacías (`iam_db`, `catalog_db`, `orders_db`, `chat_db`, `media_db`) e inspección directa de `information_schema.columns`, `pg_constraint` y `pg_indexes`.
- **Esperado vs. observado:**
  - *Esperado por lectura de código:* 8 tablas migradas y 2 FKs físicas (`perfiles.id_usuario -> usuarios.id_usuario` y `publicaciones.id_categoria -> categorias.id_categoria`).
  - *Observado en PostgreSQL 16 limpio (`8299e08`):* 8 tablas migradas, **1 sola FK física** (`fk_publicaciones_categoria`), ausencia de FK física en `perfiles` y `chat_mensajes`, y presencia confirmada del índice único parcial `idx_ordenes_activa_unica`.
- **Limitaciones:**
  - No se ejecutaron pruebas automatizadas como parte de ALL-166.
  - El esquema limpio muestra el commit `8299e08` sobre bases vacías; una base con migraciones anteriores puede diferir.
  - Verificación realizada en entorno PostgreSQL local limpio; **no se verificó el esquema vivo del clúster Kubernetes**.
  - Validación de revisión cruzada con responsables de modelos pendiente hasta revisión del PR.
