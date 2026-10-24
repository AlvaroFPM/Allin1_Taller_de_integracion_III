# Allin1 — Estructura del Proyecto

> Marketplace de trueques e intercambios de servicios. Monorepo con frontend Next.js (App Router), backend Go (gRPC + REST Gateway), orquestación con Docker Compose, despliegue en Kubernetes y pipelines de CI en GitHub Actions.

---

## Árbol de carpetas principal (Profundidad 3)

```
Allin1_Taller_de_integracion_III/
├── .github/
│   ├── workflows/
│   │   ├── backend-go-ci.yml        # CI para backend Go (Protoc, Build y Tests)
│   │   ├── frontend-ci.yml          # CI para frontend Next.js (Linting y Build)
│   │   └── lint.yml                 # Linting y validaciones generales (paths: frontend)
│   └── pull_request_template.md     # Plantilla estándar para Pull Requests
│
├── backend-go/                      # Backend principal en Go — Clean Architecture
│   ├── api/
│   │   ├── openapi/                 # Especificaciones Swagger / OpenAPI v2 (auth, publication, orders, chat)
│   │   └── proto/                   # Contratos de interfaz Protobuf (auth, publication, orders, chat)
│   ├── cmd/                         # Puntos de entrada ejecutables de los microservicios
│   │   ├── catalog/                 # Servidor del microservicio Catalog
│   │   ├── chat/                    # Servidor del microservicio Chat (gRPC + Gateway)
│   │   ├── iam/                     # Servidor del microservicio IAM (Auth)
│   │   └── media/                   # Servidor del microservicio Media
│   ├── internal/                    # Código interno protegido de la aplicación
│   │   ├── api/                     # Adaptadores de transporte: gRPC pb y HTTP handlers (chat, media, pb)
│   │   ├── database/                # Conexión centralizada a PostgreSQL vía GORM
│   │   ├── middleware/              # Interceptor unario gRPC (JWT) y middleware HTTP (Auth)
│   │   ├── models/                  # Entidades y esquemas GORM (usuario, perfil, publication, media, order, chat)
│   │   ├── seed/                    # Carga inicial de datos demostrativos
│   │   └── service/                 # Servicios de lógica de negocio pura (auth, publication, media, order, chat)
│   ├── k8s/                         # Manifiestos de Kubernetes para microservicios Go
│   │   ├── catalog/                 # Deployment, Service, ConfigMap, Secrets y PostgreSQL
│   │   ├── chat/                    # Deployment y Service (pendientes ConfigMap, Secret y PostgreSQL)
│   │   ├── gateway/                 # Deployment, Service, Ingress y ConfigMap
│   │   ├── iam/                     # Deployment, Service, ConfigMap, Secrets y PostgreSQL
│   │   ├── media/                   # PVC para BD de Media (pvc.yaml; no incluye aún resto de manifiestos)
│   │   └── orders/                  # Deployment y Service (pendientes ConfigMap, Secret y PostgreSQL)
│   ├── third_party/                 # Definiciones proto de Google API (annotations, http)
│   │   └── google/
│   ├── .dockerignore
│   ├── .gitignore
│   ├── catalog.exe                  # Binario compilado local para pruebas en Windows
│   ├── Dockerfile                   # Construcción multi-stage parametrizada (SERVICE_PATH)
│   ├── Dockerfile.chat              # Construcción multi-stage scratch para microservicio Chat
│   ├── Dockerfile.orders            # Construcción multi-stage scratch para microservicio Orders
│   ├── generate.ps1                 # Script PowerShell para compilación de protos en Windows
│   ├── go.mod                       # Módulos y dependencias de Go (Go 1.27.1)
│   ├── go.sum                       # Checksums de dependencias de Go
│   ├── install-deps.ps1             # Instalación automatizada de protoc plugins en Windows
│   ├── Makefile                     # Tareas de generación gRPC, OpenAPI y dependencias
│   └── README.md
│
├── backend-microservices/           # [HEREDADO / FUERA DE ALCANCE] Backend monolítico NestJS
│   ├── apps/                        # Microservicios NestJS descartados (catalog, iam, etc.)
│   ├── dist/                        # Compilados de NestJS
│   ├── libs/shared/                 # Librerías compartidas de NestJS
│   ├── prisma/                      # Esquemas y seeds de Prisma ORM
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── package.json
│   └── tsconfig.json
│
├── Documentacion Sprint 0/          # Documentación académica y diagramas iniciales
│   ├── Diagramas Allin1/            # Diagramas MER, componentes, secuencia y arquitectura
│   ├── Mockups Allin1/              # Wireframes y prototipos visuales de pantallas
│   ├── Casos de uso principales.pdf
│   ├── Informe_Swebok_Taller_de_integracion_III_sprint_0 (1).pdf
│   ├── Matriz de trazabilidad.pdf
│   ├── Migracion_Backend_Go_Protobuf.md
│   ├── Modelo_de_Negocio.docx.pdf
│   ├── Propuesta de proyecto, definicion de microservicios y tecnologias.pdf
│   ├── Reglas de negocio (1) (1).pdf
│   └── Requisitos funcionales y no funcionales.pdf
│
├── frontend-marketplace/            # Frontend Web — Next.js 16 (App Router)
│   ├── k8s/                         # Manifiestos Kubernetes para el cliente web
│   │   ├── deployment.yaml
│   │   ├── ingress.yaml
│   │   └── service.yaml
│   ├── public/                      # Assets estáticos y vectores SVG
│   ├── src/
│   │   ├── app/                     # Rutas del App Router (explorar, login, perfil, etc.)
│   │   ├── components/              # Componentes UI reutilizables y modulares
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Clientes HTTP, utilidades de sesión y fechas
│   │   ├── services/                # Servicios de consumo de APIs (Auth, Publicaciones)
│   │   ├── store/                   # Manejo de estado global con Zustand
│   │   ├── types/                   # Definiciones de tipos TypeScript del dominio
│   │   └── middleware.ts            # Middleware de protección y enrutamiento en Next.js
│   ├── Dockerfile                   # Dockerfile de producción para Next.js
│   ├── next.config.ts               # Configuración del framework Next.js
│   ├── package.json                 # Dependencias y scripts de Node.js
│   ├── postcss.config.mjs           # Configuración de PostCSS
│   └── tsconfig.json                # Configuración de compilación TypeScript
│
├── scripts/                         # Scripts auxiliares multiplataforma
│   ├── gen-env.js                   # Generador unificado de archivos .env (IAM, Catalog, Orders, Chat)
│   └── wait-ports.js                # Verificador de disponibilidad de puertos de servicios base
│
├── .env                             # Variables de entorno locales activas
├── .env.example                     # Plantilla de variables de entorno requeridas
├── docker-compose.yml               # Orquestación de contenedores locales (PostgreSQL, Go, Web)
├── load_test.js                     # Script de pruebas de carga con k6
├── Makefile                         # Automatización centralizada para Windows, Linux y macOS
├── payload.json                     # Archivo payload de muestra para pruebas de API
├── PROJECT_CONTEXT.md               # Contexto detallado de negocio y arquitectura
├── PROJECT_STRUCTURE.md             # Este mapa y estructura del repositorio
├── README.md                        # Guía de inicio rápido y configuración del proyecto
└── setup.cmd                        # Script interactivo de inicialización para Windows
```

---

## 1. Frontend (`frontend-marketplace`)

Aplicación web desarrollada en Next.js utilizando App Router, TypeScript y TailwindCSS v4. Se comunica con las APIs REST expuestas por el gRPC-Gateway de los microservicios en Go.

| Categoría | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.3 |
| UI | React / React DOM | 19.2.8 |
| Lenguaje | TypeScript | ^5 |
| Estilos | TailwindCSS + PostCSS plugin | ^4 |
| Estado global | Zustand | ^5.0.15 |
| Cliente HTTP | Axios | ^1.20.0 |
| Formularios y Validación | React Hook Form + Resolvers + Zod | ^7.88.0 / ^5.9.1 / ^4.6.5 |
| Manejo de Cookies | js-cookie | ^3.0.8 |
| Manipulación de Fechas | date-fns | ^4.4.0 |
| Utilidades CSS | clsx + tailwind-merge | ^2.1.1 / ^3.6.0 |

### Rutas y Páginas (`src/app/`)
- `layout.tsx`: Layout raíz con tipografía, metadatos y envolturas globales.
- `page.tsx`: Landing page principal (Home) con categorías destacadas, cómo funciona y testimonios.
- `explorar/`:
  - `page.tsx`: Catálogo general de publicaciones con filtros por categoría, tipo de servicio y precios.
  - `loading.tsx`: Estado de carga con skeletons para transiciones fluidas.
- `login/`:
  - `page.tsx`: Pantalla de inicio de sesión de usuarios.
- `registro/`:
  - `page.tsx`: Pantalla de registro de nuevos usuarios.
- `perfil/`:
  - `page.tsx`: Visualización de perfil de usuario, actividad y modal de edición.
- `publicar/`:
  - `page.tsx`: Asistente interactivo en dos pasos para crear publicaciones de servicios o trabajos.
- `globals.css` / `favicon.ico`: Estilos base y favicon del sitio.

### Componentes (`src/components/`)
- **`components/ui/`**: Primitivas de interfaz reutilizables (`badge.tsx`, `button.tsx`, `card.tsx`, `confirm-dialog.tsx`, `filter-bar.tsx`, `input.tsx`, `modal.tsx`, `skeleton.tsx`, `spinner.tsx`, `textarea.tsx`, `toast.tsx`, `index.ts`).
- **`components/shared/`**: Componentes de dominio y composición:
  - Navegación: `navbar.tsx`, `navbar-guest.tsx`, `navbar-user.tsx`, `navbar-user-dropdown.tsx`, `footer.tsx`.
  - Autenticación: `login-form.tsx`, `login-card.tsx`, `register-form.tsx`, `register-card.tsx`.
  - Catálogo y Publicaciones: `catalog-grid.tsx`, `catalog-search-header.tsx`, `catalog-sidebar-filters.tsx`, `publication-card.tsx`, `publication-card-skeleton.tsx`, `create-publication-form.tsx`, `publication-live-preview.tsx`, `publication-type-selector.tsx`.
  - Inicio: `home-hero.tsx`, `home-categories.tsx`, `home-how-it-works.tsx`, `home-recent-activity.tsx`, `home-reviews.tsx`.
  - Perfil: `profile-personal-card.tsx`, `profile-reputation-card.tsx`, `profile-activity-panel.tsx`, `profile-edit-modal.tsx`.

### Servicios, Librerías y Estado
- **`services/`**:
  - `api.ts`: Configuración base y llamadas genéricas.
  - `authService.ts`: Funciones de autenticación (`loginUser`, `registerUser`).
  - `publicationService.ts`: Funciones del catálogo (`getCategories`, `getPublications`, `createPublication`).
- **`lib/`**:
  - `axios.ts`: Instancia central de Axios con interceptores de request (inyección de JWT) y response (redirección en 401).
  - `apiClient.ts`: Cliente Axios complementario para retrocompatibilidad de servicios de autenticación.
  - `authCookies.ts`: Helpers para guardar y eliminar tokens en cookies del navegador (`js-cookie`).
  - `dateUtils.ts`: Formateo de fechas relativas y manejo de timestamps Protobuf.
  - `utils.ts`: Utilidad `cn()` que combina `clsx` y `tailwind-merge`.
  - `mappers/auth.ts`: Transformación entre respuestas del backend y modelos del frontend.
- **`store/`**:
  - `useAuthStore.ts`: Store Zustand para gestión del usuario autenticado y token de sesión.
- **`types/`**:
  - Tipos TypeScript para `auth.ts`, `catalog.ts`, `home.ts`, `navigation.ts`, `profile.ts` y `publication.ts`.
- **`middleware.ts`**: Middleware de Next.js para intercepción de solicitudes a nivel de servidor edge.
- **`k8s/`**: Manifiestos de Kubernetes para despliegue web (`deployment.yaml`, `service.yaml`, `ingress.yaml`).

---

## 2. Backend Go (`backend-go`)

Backend distribuido implementado bajo principios de Clean Architecture. Combina servidores nativos gRPC con un reverse-proxy `grpc-gateway` para exponer endpoints REST JSON en un único microservicio.

| Categoría | Tecnología | Versión |
|---|---|---|
| Lenguaje | Go | 1.27.1 |
| Framework RPC | gRPC | v1.83.2 |
| REST Gateway | grpc-gateway | v2.30.0 |
| Serialización | Protocol Buffers (proto3) | v1.36.12 |
| ORM | GORM | v1.31.2 |
| Driver Base de Datos | gorm.io/driver/postgres | v1.6.3 |
| Validación | go-playground/validator/v10 | v10.30.5 |
| Tokens de Sesión | golang-jwt/jwt/v5 | v5.3.1 |
| Encriptación de Claves | golang.org/x/crypto (bcrypt) | v0.57.0 |
| Almacenamiento Multimedia | Cloudinary Go SDK v2 | v2.16.0 |
| Manejo de CORS | rs/cors | v1.11.1 |
| Variables de Entorno | godotenv | v1.5.1 |
| Testing y Aserciones | testify | v1.11.1 |

### Microservicios (`cmd/`)
- **`cmd/iam/main.go`**: Microservicio de Identity & Access Management. Escucha en el puerto gRPC `50051` y expone el gateway REST en el puerto `8080` (en contenedor/local mapeado a `8081`). Maneja registro, login, tokens JWT y perfiles de usuario.
- **`cmd/catalog/main.go`**: Microservicio de Catálogo y Publicaciones. Escucha en el puerto gRPC `50052` y expone el gateway REST en el puerto `8080` (en contenedor/local mapeado a `8082`). Maneja listado paginado, filtros y creación de publicaciones.
- **`cmd/media/main.go`**: Microservicio de procesamiento multimedia y subida a Cloudinary. Expone API REST en el puerto `8083` (sin gRPC), con endpoints protegidos por middleware de autenticación HTTP.
- **`cmd/chat/main.go`**: Microservicio de Chat y Mensajería. Escucha en el puerto gRPC `50054` y expone el gateway REST en el puerto `8085` (según propuesta de puertos de Dockerfile.chat). Maneja salas de chat y mensajes con persistencia en PostgreSQL (`chat_salas`, `chat_mensajes`).
- *(Nota)*: `cmd/orders/` aún no cuenta con entrypoint en Go (`main.go` pendiente de implementar; infraestructura Dockerfile y K8s preparada).
- **`catalog.exe`**: Binario compilado localmente en Windows para pruebas de ejecución rápida.

### Esquemas de Interfaz y Contratos (`api/`)
- **`api/proto/`**:
  - `auth.proto`: Definición de mensajes y RPCs para `AuthService` (`Register`, `Login`, `GetProfile`, `UpdateProfile`), con anotaciones `google.api.http`.
  - `publication.proto`: Definición de mensajes, enums y RPCs para `PublicationService` (`CreatePublication`, `GetCategories`, `GetPublication`, `ListPublications`).
  - `orders.proto`: Definición de mensajes, enum `EstadoOrden` (FSM: PENDIENTE, ACEPTADA, COMPLETADA, CANCELADA) y RPCs para `OrderService` (`CreateOrder`, `PatchOrderStatus`, `GetOrder`, `ListMyPurchases`, `ListMySales`).
  - `chat.proto`: Definición de mensajes y RPCs para `ChatService` (`SendMessage`, `GetMessages`, `GetOrCreateRoom`, `ListRooms`, `MarkAsRead`, `GetUnreadCount`).
- **`api/openapi/`**:
  - `auth.swagger.json`: Especificación OpenAPI v2 / Swagger del servicio de autenticación.
  - `publication.swagger.json`: Especificación OpenAPI v2 / Swagger del servicio de catálogo.
  - `orders.swagger.json`: Especificación OpenAPI v2 / Swagger del servicio de órdenes.
  - `chat.swagger.json`: Especificación OpenAPI v2 / Swagger del servicio de chat.
  - `auth.config.yaml`: Configuración de generación de OpenAPI para grpc-gateway.

### Paquetes Internos (`internal/` — Clean Architecture)
- **`internal/api/pb/`**: Stubs gRPC y código de gateway autogenerados:
  - `auth/`: `auth.pb.go`, `auth.pb.gw.go`, `auth_grpc.pb.go`.
  - `publication/`: `publication.pb.go`, `publication.pb.gw.go`, `publication_grpc.pb.go`.
  - `orders/`: `orders.pb.go`, `orders.pb.gw.go`, `orders_grpc.pb.go`.
  - `chat/`: `chat.pb.go`, `chat.pb.gw.go`, `chat_grpc.pb.go`.
- **`internal/api/chat/`**:
  - `router.go`, `router_test.go`: Enrutador y registro de handlers gRPC y gRPC-Gateway para Chat.
- **`internal/api/media/`**:
  - `media_handler.go`, `upload_handler.go`, `upload_handler_test.go`: Handlers HTTP para recepción, validación y subida de archivos multimedia.
- **`internal/database/`**:
  - `postgres.go`: Conexión robusta a PostgreSQL mediante GORM (`ConnectDB()`), con reintentos y soporte de variables de entorno.
- **`internal/middleware/`**:
  - `jwt_interceptor.go`, `jwt_interceptor_test.go`: Interceptor unario gRPC (`UnaryAuthInterceptor`). Extrae el header `Authorization: Bearer <token>`, valida la firma criptográfica HMAC con `JWT_SECRET`, inyecta `user_id` en el contexto y protege rutas privadas.
  - `jwt_http.go`: Middleware de autenticación para servidores HTTP REST estándar (`HTTPAuth`). Valida token Bearer y suministra `user_id` en el contexto HTTP (utilizado en endpoints directos como Media).
- **`internal/models/`**:
  - `usuario.go`: Modelo GORM de la tabla `usuarios` (RUT, correo, contraseña hasheada, rol).
  - `perfil.go`: Modelo GORM de la tabla `perfiles` (datos personales, biografía, ciudad, avatar).
  - `publication.go`: Modelo GORM de las tablas `publicaciones` y `categorias` (con soporte para `deleted_at`).
  - `media.go`: Modelo GORM de la tabla `media` para metadatos de archivos multimedia.
  - `order.go`: Modelo GORM de la tabla `ordenes` (estados de orden, comprador, vendedor, publicación, precio).
  - `chat.go`: Modelos GORM de las tablas `chat_salas` y `chat_mensajes`.
- **`internal/seed/`**:
  - `seed.go`: Inserción condicional de categorías y datos semilla para inicializar el catálogo en frío.
- **`internal/service/`**:
  - `auth_service.go`, `auth_service_test.go`: Implementación de lógica de negocio para registro (validación RN-06, bcrypt, persistencia GORM), login y obtención/actualización de perfil.
  - `publication_service.go`, `publication_service_test.go`: Implementación de reglas de negocio para publicaciones (RN-12 exclusión de publicaciones propias, RN-23 validación de precios, paginación segura).
  - `order_service.go`, `order_service_test.go`: Lógica de negocio de órdenes (FSM de transiciones válidas, validación RN-22 para evitar órdenes duplicadas activas).
  - `chat_service.go`, `chat_service_test.go`: Lógica de negocio de chat (creación/recuperación de salas, envío de mensajes, marcado de lectura y conteo de no leídos).
  - `mappers.go`: Conversores entre entidades de base de datos GORM y mensajes tipados Protobuf.
  - `media/`: Servicios de carga y validación a Cloudinary (`upload_service.go`, `validator.go`, `processor.go`, `types.go`, `errors.go`).

### Dockerfiles y Construcción de Contenedores
- **`Dockerfile`**: Construcción multi-stage parametrizada mediante el argumento `SERVICE_PATH` (ej. `cmd/iam`, `cmd/catalog`, `cmd/media`). Utiliza `golang:1.27-alpine` como builder y genera imagen runtime Alpine liviana.
- **`Dockerfile.orders`**: Construcción multi-stage optimizada para producción del microservicio Orders (contexto `backend-go/`). Builder en `golang:1.27-alpine` con caché de BuildKit (`--mount=type=cache`), compilación estática (`CGO_ENABLED=0 -trimpath -ldflags="-s -w"`), y etapa final sobre `scratch` con usuario no-root `65532:65532`, `ca-certificates.crt` y `tzdata`. Expone HTTP `8084` y gRPC `50053`. Imagen de ~10.4 MB (~2.78 MB comprimida) sin shell (los healthchecks en K8s operan mediante tcpSocket).
- **`Dockerfile.chat`**: Construcción multi-stage optimizada para producción del microservicio Chat (contexto `backend-go/`). Esquema idéntico a Orders (`golang:1.27-alpine` → `scratch`, usuario `65532:65532`, sin shell). Expone HTTP `8085` y gRPC `50054` (puertos propuestos).

### Infraestructura Kubernetes (`backend-go/k8s/`)
- **`catalog/`**: `configmap.yaml`, `deployment.yaml`, `postgres-catalog.yaml` (BD dedicada), `secret.yaml`, `secret.example.yaml`, `service.yaml`.
- **`chat/`**: `deployment.yaml`, `service.yaml`. Manifiestos preparados para el microservicio Chat (Go). No incluye aún ConfigMap (`chat-db-config`), Secret (`chat-db-secret`) ni PostgreSQL dedicado (`postgres-chat`).
- **`iam/`**: `configmap.yaml`, `deployment.yaml`, `namespace.yaml`, `postgres-iam.yaml` (BD dedicada), `secret.yaml`, `secret.example.yaml`, `service.yaml`.
- **`gateway/`**: `configmap.yaml`, `deployment.yaml`, `ingress.yaml`, `service.yaml`.
- **`media/`**: `pvc.yaml`. PersistentVolumeClaim (`postgres-media-pvc`) para la base de datos PostgreSQL de Media (`media_db`). No incluye aún el resto de manifiestos (`postgres-media`, `deployment.yaml`, `service.yaml`, `configmap.yaml`, `secret.yaml`).
- **`orders/`**: `deployment.yaml`, `service.yaml`. Manifiestos preparados para el microservicio Orders (Go). No incluye aún ConfigMap (`orders-db-config`), Secret (`orders-db-secret`) ni PostgreSQL dedicado (`postgres-orders`).

---

## 3. Backend Monolítico NestJS (`backend-microservices`)

> **Estado**: **Heredado / Fuera de alcance**. Este directorio contiene el desarrollo previo en NestJS + Prisma ORM. Fue sustituido por la arquitectura en Go (`backend-go`). Se conserva en el repositorio como referencia histórica y no participa en la ejecución actual de Docker Compose ni en los flujos principales de CI.

- **`apps/`**: Módulos del monolito original (`backend-microservices`, `catalog`, `chat`, `geo`, `iam`, `match`, `notify`, `payments`, `reputation`, `search`, `support`).
- **`prisma/`**: Esquemas de Prisma ORM y scripts de seed (`seed.ts`, `seed-iam.ts`, `seed-catalog.ts`).
- **`libs/shared/`**: Clases y utilidades compartidas.

---

## 4. Infraestructura, Pruebas y CI/CD

### Orquestación Local (`docker-compose.yml`)
Configura la red compartida `allin1_network` y levanta el entorno de desarrollo completo con bases de datos aisladas:

| Servicio | Tipo / Imagen | Puerto Host | Puerto Interno | Base de Datos / Rol |
|---|---|---|---|---|
| `postgres_iam` | `postgres:16-alpine` | `5433` | `5432` | `iam_db` (almacenamiento de usuarios y credenciales) |
| `postgres_catalog` | `postgres:16-alpine` | `5434` | `5432` | `catalog_db` (publicaciones y categorías) |
| `postgres_media` | `postgres:16-alpine` | `5435` | `5432` | `media_db` (metadatos de archivos multimedia) |
| `postgres_chat` | `postgres:16-alpine` | `5436` | `5432` | `chat_db` (perfil `chat`) |
| `postgres_orders` | `postgres:16-alpine` | `5437` | `5432` | `orders_db` (perfil `orders`) |
| `iam` | Go (`cmd/iam`) | `8081` | `8080` (HTTP) / `50051` (gRPC) | Auth, registro, login y perfiles |
| `catalog` | Go (`cmd/catalog`) | `8082` | `8080` (HTTP) / `50051` (gRPC) | CRUD de publicaciones y catálogo |
| `media` | Go (`cmd/media`) | `8083` | `8083` | API de procesamiento y carga de imágenes |
| `orders` | Go (`Dockerfile.orders`) | `8084` | `8084` (HTTP) / `50053` (gRPC) | Microservicio de órdenes (perfil `orders`, sin healthcheck) |
| `chat` | Go (`Dockerfile.chat`) | `8085` | `8085` (HTTP) / `50054` (gRPC) | Microservicio de chat (perfil `chat`, sin healthcheck) |
| `frontend-marketplace` | Next.js 16 (Node.js) | `3000` | `3000` | Interfaz gráfica de usuario web |

- **Volúmenes persistentes**: `iam_db_data`, `catalog_db_data`, `media_db_data`, `orders_db_data` y `chat_db_data`.
- **Levantamiento con perfiles**: Los servicios `orders`, `chat`, `postgres_orders` y `postgres_chat` se levantan explícitamente mediante:
  ```bash
  docker compose --profile orders --profile chat up -d --build
  ```
  (Requiere `POSTGRES_PASSWORD_ORDERS` y `POSTGRES_PASSWORD_CHAT` en el archivo `.env`).
- **Healthchecks**: `orders` y `chat` no disponen de healthcheck en Compose debido a que utilizan imágenes basadas en `scratch` (sin `wget` ni intérprete de comandos shell).

### Automatización y Pruebas
- **`Makefile` (raíz)**: Automatización multiplataforma (Windows/Linux/macOS):
  - `make install-deps`: Instala dependencias del sistema y herramientas de Go/Protobuf.
  - `make up` / `make down`: Levanta o detiene los servicios mediante Docker Compose.
  - `make setup`: Inicialización completa en una sola instrucción (`env` -> `deps` -> `up`).
- **`scripts/`**:
  - `scripts/gen-env.js`: Genera el archivo `.env` local combinando variables y defaults necesarios, incluyendo ahora `POSTGRES_PASSWORD_ORDERS` y `POSTGRES_PASSWORD_CHAT`.
  - `scripts/wait-ports.js`: Espera activamente a que los puertos de servicios base (`5433`, `5434`, `8081`, `8082` y `3000`) respondan antes de dar por listo el entorno. No incluye los puertos de los servicios opcionales por perfil (`5436`, `5437`, `8084`, `8085`) ni los de Media (`5435`, `8083`).
- **`setup.cmd`**: Script por lotes para preparar y levantar el entorno fácilmente en sistemas Windows.
- **`load_test.js`**: Script de pruebas de carga con **k6**:
  - Evalúa la resiliencia del endpoint de catálogo (`GET http://localhost:8082/v1/publications`).
  - Simula 100 usuarios virtuales concurrentes (`vus: 100`) durante 30 segundos (`duration: '30s'`).
- **`payload.json`**: Muestra de cuerpo JSON para pruebas de publicación de servicios.

### Integración Continua (`.github/workflows/`)
- **`backend-go-ci.yml`**: Se activa en Pull Requests hacia `develop` cuando hay cambios en `backend-go/**`. Instala Go 1.27, verifica compilación de Protobuf, compila los microservicios y ejecuta la suite de pruebas unitarias (`go test -v ./...`).
- **`frontend-ci.yml`**: Se activa en Pull Requests hacia `develop` cuando hay cambios en `frontend-marketplace/**`. Instala dependencias con `npm ci`, ejecuta el linter de ESLint y compila el bundle de producción de Next.js (`npm run build`).
- **`lint.yml`**: Pipeline general de validación de sintaxis y calidad de código en el monorepo (con filtro de rutas hacia `frontend-marketplace/**` y `.github/workflows/lint.yml`).
