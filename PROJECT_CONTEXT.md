# PROJECT_CONTEXT.md — Contexto del Proyecto Allin1

> Documento de referencia interna para el equipo. Describe la arquitectura,
> convenciones, despliegue y deuda técnica del proyecto.

---

## 1. Visión General

Allin1 es un marketplace universitario compuesto por microservicios Go
(IAM, Catalog, Media) con un frontend Next.js.

## 2. Repositorio

Monorepo con la siguiente estructura principal:

```
backend-go/              # Monorepo Go (Clean Architecture)
  cmd/                   # Ejecutables por microservicio
  internal/              # Código compartido (services, models, middleware)
  api/proto/             # Contratos .proto (gRPC + gRPC-Gateway)
  api/openapi/           # Swagger JSON generado automáticamente por protoc
  k8s/                   # Manifiestos Kubernetes
    iam/                 # Microservicio IAM (auth)
    gateway/             # API Gateway Nginx
frontend-marketplace/    # Frontend Next.js
Documentacion Sprint 0/  # Documentación de diseño y negocio
```

## 3. Stack Tecnológico

- **Backend**: Go, gRPC, gRPC-Gateway, GORM, PostgreSQL
- **Frontend**: Next.js
- **Infraestructura**: Kubernetes (cluster UCT), Docker, Nginx
- **CI/CD**: GitHub Actions

## 4. Arquitectura Backend Go

El backend sigue Clean Architecture dentro de un monorepo Go:

| Capa | Directorio | Responsabilidad |
|------|-----------|-----------------|
| Entrypoint | `cmd/<servicio>/main.go` | Inicialización: conectar BD, levantar gRPC + Gateway |
| Contrato | `api/proto/` | Definiciones `.proto` (gRPC + REST vía `google.api.http`) |
| Controlador | `internal/api/` | Handlers gRPC — reciben request, llaman al service |
| Lógica | `internal/service/` | Lógica de negocio pura, sin conocer HTTP/gRPC |
| Modelo | `internal/models/` | Structs GORM que mapean a tablas PostgreSQL |
| Datos | `internal/database/` | Conexión a PostgreSQL (GORM) |
| Middleware | `internal/middleware/` | Interceptores gRPC (autenticación JWT, etc.) |

### Variables de entorno del backend

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `DB_HOST` | (ninguno) | Host de PostgreSQL |
| `DB_PORT` | (ninguno) | Puerto de PostgreSQL |
| `DB_USER` | (ninguno) | Usuario de PostgreSQL |
| `DB_PASSWORD` | (ninguno) | Password de PostgreSQL |
| `DB_NAME` | (ninguno) | Nombre de la base de datos |
| `DB_SSLMODE` | (ninguno) | Modo SSL para la conexión |
| `GRPC_PORT` | (ninguno) | Puerto del servidor gRPC |
| `HTTP_PORT` | (ninguno) | Puerto del gRPC-Gateway (REST) |
| `JWT_SECRET` | (ninguno) | Clave HS256 para firmar/verificar JWT. Si está vacía, el código usa el fallback inseguro `"super-secret-key-development-only"` (NO es panic). Usada en `internal/service/auth_service.go` (`generateJWT`) e `internal/middleware/jwt_interceptor.go`. Generar con `openssl rand -hex 32`. |

## 5. Microservicios

| Servicio | Puerto gRPC | Puerto HTTP (Gateway) | Descripción |
|----------|------------|----------------------|-------------|
| IAM      | 50051      | 8080                 | Autenticación (register, login, profile) |
| Catalog  | 50052      | 8082                 | Publicaciones del marketplace |
| Media    | —          | 8083                 | Gestión de imágenes y subida a Cloudinary (`cmd/media`) |
| Orders   | 50053      | 8084                 | Gestión de órdenes y contrataciones (`cmd/orders` pendiente de implementar; manifiestos K8s listos) |
| Chat     | 50054      | 8085                 | Mensajería entre usuarios (`cmd/chat` implementado; puertos propuestos según Dockerfile.chat; manifiestos K8s en `k8s/chat/`, aún no aplicados) |
| Gateway  | —          | 8080                 | Reverse proxy Nginx, único punto de entrada externo |
| Frontend | —          | 3000                 | Next.js (standalone), marketplace UI |

### 5.1 API Gateway (`backend-go/k8s/gateway/`)

El API Gateway es un reverse proxy Nginx que actúa como punto de entrada
único para todos los microservicios. Reemplaza el esquema anterior donde
el Ingress apuntaba directamente al Service `iam`.

**Flujo de tráfico:**
```
Internet
  → student-aalarcon.dev.censei.cl (DNS → proxy.inf.uct.cl)
    → Ingress Controller (nginx del cluster)
      → Service api-gateway (ClusterIP, port 80)
        → Pod Nginx (port 8080)
          → /v1/auth/*       → Service iam:8080     → Pod IAM (Go)
          → /v1/publications → Service catalog:8082 → Pod Catalog (Go)
          → /v1/categories   → Service catalog:8082 → Pod Catalog (Go)
          → /*               → 404 JSON
```

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `configmap.yaml` | ConfigMap `api-gateway-config` | Configuración Nginx (`default.conf`) |
| `deployment.yaml` | Deployment `api-gateway` | Pod Nginx (nginxinc/nginx-unprivileged:1.27-alpine) |
| `service.yaml` | Service `api-gateway` | ClusterIP, port 80 → targetPort 8080 |
| `ingress.yaml` | Ingress `api-gateway` | Expone el gateway al exterior (host + path /) |

**Orden de apply para el gateway:**
```
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

> **IMPORTANTE**: Aplicar el gateway DESPUÉS de que los Services de los
> microservicios upstream (iam, catalog) ya existan. Si Nginx no puede
> resolver un upstream al arrancar, el Pod falla.

## 6. Docker Compose (desarrollo local)

- `JWT_SECRET` se inyecta al servicio `iam` vía `${JWT_SECRET}` desde `.env`
- Passwords de PostgreSQL vía `${POSTGRES_PASSWORD_IAM}`, `${POSTGRES_PASSWORD_CATALOG}`, `${POSTGRES_PASSWORD_ORDERS}` y `${POSTGRES_PASSWORD_CHAT}`
- Ver `.env.example` para la lista completa de variables y `node scripts/gen-env.js` para generación automática de secretos en desarrollo.
- **Servicios bajo perfiles (`orders` y `chat`)**:
  - `postgres_orders` (perfil `orders`): PostgreSQL 16 Alpine, puerto host `5437:5432`, base de datos `orders_db`, volumen `orders_db_data`.
  - `postgres_chat` (perfil `chat`): PostgreSQL 16 Alpine, puerto host `5436:5432`, base de datos `chat_db`, volumen `chat_db_data`.
  - `orders` (perfil `orders`): Build con `backend-go/Dockerfile.orders`, puerto HTTP `8084:8084` publicado (gRPC 50053 no publicado en host), depende de `postgres_orders` (healthy). Sin healthcheck de Compose por basarse en imagen `scratch` (sin `wget` ni shell).
  - `chat` (perfil `chat`): Build con `backend-go/Dockerfile.chat`, puerto HTTP `8085:8085` publicado (gRPC 50054 no publicado en host), depende de `postgres_chat` (healthy). Sin healthcheck de Compose por basarse en imagen `scratch`.
  - Comando para levantar los servicios con perfiles: `docker compose --profile orders --profile chat up -d --build` (requiere `POSTGRES_PASSWORD_ORDERS` y `POSTGRES_PASSWORD_CHAT` en el `.env` local).
  - `make up` y `docker compose up` estándar (sin perfiles) continúan levantando únicamente los servicios base (`postgres_iam`, `postgres_catalog`, `postgres_media`, `iam`, `catalog`, `media`, `frontend-marketplace`).
- **Mapa de puertos de bases de datos en el host**:
  - IAM: `5433`
  - Catalog: `5434`
  - Media: `5435`
  - Chat: `5436`
  - Orders: `5437` (reasignado para resolver choque previo con Media en 5435)
- **Mapa de puertos HTTP en el host**:
  - Frontend: `3000`
  - IAM: `8081`
  - Catalog: `8082`
  - Media: `8083`
  - Orders: `8084`
  - Chat: `8085`
- **Volúmenes persistentes**: `iam_db_data`, `catalog_db_data`, `media_db_data`, `orders_db_data`, `chat_db_data`.

## 7. Convenciones de Naming

- Labels Kubernetes: `app`, `project: allin1`, `tier: backend|frontend`
- Namespace: `student-aalarcon`
- Secretos K8s: `<servicio>-db-secret` (ej. `iam-db-secret`)
- Imágenes Docker Hub: `am4roo/allin1-<servicio>-<stack>:<tag>`
  - Tag vigente de IAM: `am4roo/allin1-iam-go:20261006-5cdbdee`
  - Tag vigente de Catalog: `am4roo/allin1-catalog-go:20261006-5cdbdee`
  - Imagen de Orders: `am4roo/allin1-orders-go:<tag>` (tag en manifiesto K8s: `TAG_A_DEFINIR`, sin build oficial aún)
  - Imagen de Chat: `am4roo/allin1-chat-go:<tag>` (tag en manifiesto K8s: `TAG_A_DEFINIR`, sin build oficial aún)
  - Ejemplo frontend (vigente): `am4roo/allin1-frontend-next:20260929-b3e03c9`
  - **Formato de tag recomendado**: `YYYYMMDD-<hash-corto-git>` (NO usar `latest`)

## 8. Kubernetes

### Namespace

Todos los recursos se despliegan en `student-aalarcon`.

### Manifiestos de IAM (`backend-go/k8s/iam/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `namespace.yaml` | Namespace | Namespace `student-aalarcon` |
| `configmap.yaml` | ConfigMap `iam-db-config` | Variables no sensibles (DB_HOST, DB_PORT) |
| `secret.example.yaml` | Secret `iam-db-secret` (template) | Variables sensibles (DB_*, JWT_SECRET) |
| `postgres-iam.yaml` | Deployment + Service | PostgreSQL para IAM |
| `deployment.yaml` | Deployment `iam` | Microservicio IAM (Go) |
| `service.yaml` | Service `iam` | ClusterIP, port 8080 |

**Orden de apply para IAM:**
```
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml          # (copia de secret.example.yaml con valores reales)
kubectl apply -f postgres-iam.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

### Manifiestos de Catalog (`backend-go/k8s/catalog/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `secret.example.yaml` | Secret `catalog-db-secret` (template) | Variables sensibles de PostgreSQL (`DB_*`) |
| `configmap.yaml` | ConfigMap `catalog-db-config` | Variables no sensibles (`DB_HOST`, `DB_PORT`, `GRPC_PORT`, `HTTP_PORT`) |
| `postgres-catalog.yaml` | PVC + StatefulSet + Service | PostgreSQL para Catalog (StatefulSet + headless Service) |
| `deployment.yaml` | Deployment `catalog` | Microservicio Catalog (Go) — puertos 8082 (HTTP) y 50052 (gRPC) |
| `service.yaml` | Service `catalog` | ClusterIP, port 8082 |

**Orden de apply para Catalog:**
```bash
# 1. Secretos de BD
cp secret.example.yaml secret.yaml
# Configurar contraseñas con openssl rand -hex 16
kubectl apply -f secret.yaml

# 2. ConfigMap no sensible
kubectl apply -f configmap.yaml

# 3. Base de datos PostgreSQL
kubectl apply -f postgres-catalog.yaml

# 4. Deployment de Catalog (tras build y reemplazo de TAG_A_DEFINIR)
kubectl apply -f deployment.yaml

# 5. Service interno
kubectl apply -f service.yaml

# 6. Actualización del API Gateway
kubectl apply -f ../gateway/configmap.yaml
kubectl rollout restart deployment/api-gateway
```

### Manifiestos de Orders (`backend-go/k8s/orders/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `deployment.yaml` | Deployment `orders` | Microservicio Orders (Go) — puertos 8084 (HTTP) y 50053 (gRPC), imagen `am4roo/allin1-orders-go:TAG_A_DEFINIR` |
| `service.yaml` | Service `orders` | ClusterIP, port 8084 → targetPort 8084 (no expone gRPC externamente, igual que Catalog) |

> **ADVERTENCIA — NO APLICAR AÚN AL CLÚSTER**:
> Los manifiestos están validados únicamente con `kubectl apply --dry-run=client` y `kubectl apply --dry-run=server`. NO deben aplicarse al clúster hasta que se creen las siguientes dependencias en otros tickets:
> 1. ConfigMap `orders-db-config` (`DB_HOST=postgres-orders`, `DB_PORT=5432`, `GRPC_PORT=50053`, `HTTP_PORT=8084`).
> 2. Secret `orders-db-secret` (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`).
> 3. Base de datos PostgreSQL dedicada `postgres-orders`.
> 4. Imagen construida en Docker Hub sustituyendo el placeholder `TAG_A_DEFINIR` por un tag inmutable `YYYYMMDD-<hash-corto-git>`.
> 5. Ruta `/v1/orders` configurada en el API Gateway Nginx (`backend-go/k8s/gateway/configmap.yaml`).

**Orden de apply para Orders (cuando existan las dependencias):**
```bash
# 1. Secretos de BD (pendiente de crear secret.example.yaml)
kubectl apply -f secret.yaml

# 2. ConfigMap no sensible (pendiente de crear configmap.yaml)
kubectl apply -f configmap.yaml

# 3. Base de datos PostgreSQL (pendiente de crear postgres-orders.yaml)
kubectl apply -f postgres-orders.yaml

# 4. Deployment de Orders (tras build y reemplazo de TAG_A_DEFINIR por tag real)
kubectl apply -f deployment.yaml

# 5. Service interno
kubectl apply -f service.yaml

# 6. Actualización del API Gateway Nginx (enrutar /v1/orders)
kubectl apply -f ../gateway/configmap.yaml
kubectl rollout restart deployment/api-gateway
```

### Manifiestos de Chat (`backend-go/k8s/chat/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `deployment.yaml` | Deployment `chat` | Microservicio Chat (Go) — puertos 8085 (HTTP) y 50054 (gRPC), imagen `am4roo/allin1-chat-go:TAG_A_DEFINIR` |
| `service.yaml` | Service `chat` | ClusterIP, port 8085 → targetPort 8085 (no expone gRPC externamente, igual que Orders y Catalog) |

> **ADVERTENCIA — NO APLICAR AÚN AL CLÚSTER**:
> Los manifiestos están validados únicamente con `kubectl apply --dry-run=client` y sintaxis YAML con PyYAML. NO deben aplicarse al clúster hasta que se creen las siguientes dependencias en otros tickets:
> 1. ConfigMap `chat-db-config` (`DB_HOST=postgres-chat`, `DB_PORT=5432`, `GRPC_PORT=50054`, `HTTP_PORT=8085`).
> 2. Secret `chat-db-secret` (`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`).
> 3. Base de datos PostgreSQL dedicada `postgres-chat`.
> 4. Imagen construida en Docker Hub sustituyendo el placeholder `TAG_A_DEFINIR` por un tag inmutable `YYYYMMDD-<hash-corto-git>`.
> 5. Rutas `/v1/chat/*` y configuración de CORS en el API Gateway Nginx (`backend-go/k8s/gateway/configmap.yaml`).

**Orden de apply para Chat (cuando existan las dependencias):**
```bash
# 1. Secretos de BD (pendiente de crear secret.example.yaml)
kubectl apply -f secret.yaml

# 2. ConfigMap no sensible (pendiente de crear configmap.yaml)
kubectl apply -f configmap.yaml

# 3. Base de datos PostgreSQL (pendiente de crear postgres-chat.yaml)
kubectl apply -f postgres-chat.yaml

# 4. Deployment de Chat (tras build y reemplazo de TAG_A_DEFINIR por tag real)
kubectl apply -f deployment.yaml

# 5. Service interno
kubectl apply -f service.yaml

# 6. Actualización del API Gateway Nginx (enrutar /v1/chat/* y CORS)
kubectl apply -f ../gateway/configmap.yaml
kubectl rollout restart deployment/api-gateway
```

### Manifiestos del gateway (`backend-go/k8s/gateway/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `configmap.yaml` | ConfigMap `api-gateway-config` | Configuración Nginx (`default.conf`) |
| `deployment.yaml` | Deployment `api-gateway` | Pod Nginx (nginxinc/nginx-unprivileged:1.27-alpine) |
| `service.yaml` | Service `api-gateway` | ClusterIP, port 80 → targetPort 8080 |
| `ingress.yaml` | Ingress `api-gateway` | Expone el gateway al exterior (host + path /) |

**Orden de apply para el gateway:**
```
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

> **IMPORTANTE**: Aplicar el gateway DESPUÉS de que los Services de los
> microservicios upstream (iam, catalog) ya existan.

### Manifiestos del frontend (`frontend-marketplace/k8s/`)

| Archivo | Recurso | Descripción |
|---------|---------|-------------|
| `deployment.yaml` | Deployment `frontend` | Next.js standalone (puerto 3000) |
| `service.yaml` | Service `frontend` | ClusterIP, port 3000 |
| `ingress.yaml` | Ingress `frontend` | Host: `marketplace-aalarcon.dev.censei.cl` |

**Orden de apply para el frontend:**
```
kubectl apply -f deployment.yaml
kubectl rollout status deployment/frontend
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

> **IMPORTANTE — Variables de BUILD y RUNTIME en el Frontend**:
> 
> 1. **Variables de BUILD (`NEXT_PUBLIC_*`)**:
>    - `NEXT_PUBLIC_API_URL`: URL del API Gateway (IAM: `/v1/auth/*`). Inyectada en build time vía `--build-arg`. En producción: `https://student-aalarcon.dev.censei.cl`.
>    - `NEXT_PUBLIC_CATALOG_API_URL`: URL del catálogo para llamadas del cliente/navegador. Inyectada vía `--build-arg`. En producción: `https://student-aalarcon.dev.censei.cl`.
>    - *Nota*: Están inlineadas en el bundle JS durante `npm run build`. Para cambiarlas es obligatorio reconstruir la imagen Docker.
> 
> 2. **Variable de RUNTIME (`CATALOG_INTERNAL_URL`)**:
>    - `CATALOG_INTERNAL_URL`: URL interna dentro de la red del cluster Kubernetes (`http://catalog:8082` provisional).
>    - Inyectada en la sección `env` del [deployment.yaml](file:///c:/Users/Amaroo/Desktop/Universidad/3er%20a%C3%B1o/2do%20semestre/Integra%203/Allin1_Taller_de_integracion_III/frontend-marketplace/k8s/deployment.yaml). La consumen los Server Components (como `src/app/page.tsx`) en el servidor Node.js sin salir a Internet ni verse afectados por certificados TLS autofirmados.
> 
> 3. **Guarda obligatoria en Dockerfile**:
>    - Antes de `npm run build`, el Dockerfile ejecuta:
>      `RUN test -n "$NEXT_PUBLIC_API_URL" && test -n "$NEXT_PUBLIC_CATALOG_API_URL" || (echo "ERROR: faltan build-args NEXT_PUBLIC_*" && exit 1)`
>      evitando builds accidentales sin URLs de producción.
> 
> 4. **Regla "Commit antes de Build"**:
>    - El tag de la imagen se construye con `YYYYMMDD-<hash-corto-git>`. El árbol de trabajo de Git (`git status`) debe estar completamente limpio antes de construir para garantizar trazabilidad exacta entre imagen y commit.
> 
> **Tag vigente desplegado**: `am4roo/allin1-frontend-next:20260929-b3e03c9`

**Flujo de tráfico del frontend:**
```
Internet
  → marketplace-aalarcon.dev.censei.cl (DNS → proxy.inf.uct.cl)
    → Ingress Controller (nginx del cluster)
      → Service frontend (ClusterIP, port 3000)
        → Pod Next.js (port 3000)
```

### Restricciones del Cluster UCT

- **Dominio**: `*-aalarcon.dev.censei.cl` (impuesto por política de admisión `rke2-edu-ingress-hostname`)
- **Path**: solo `/` permitido por hostname
- **ExternalDNS**: requiere annotation `external-dns.alpha.kubernetes.io/target: proxy.inf.uct.cl`
- **IngressClass**: `nginx`
- **Certificado TLS**: autofirmado por el cluster; los navegadores mostrarán advertencia de seguridad (esperado, ver sección 11)

## 9. Variables de Entorno en Kubernetes

### Variables de IAM (`iam-db-config` / `iam-db-secret`)

| Variable | Fuente K8s | Descripción |
|----------|-----------|-------------|
| `DB_HOST` | ConfigMap `iam-db-config` | Host de PostgreSQL (`postgres-iam`) |
| `DB_PORT` | ConfigMap `iam-db-config` | Puerto de PostgreSQL (`5432`) |
| `DB_USER` | Secret `iam-db-secret` | Usuario de PostgreSQL |
| `DB_PASSWORD` | Secret `iam-db-secret` | Password de PostgreSQL |
| `DB_NAME` | Secret `iam-db-secret` | Nombre de la base de datos (`iam_db`) |
| `DB_SSLMODE` | Secret `iam-db-secret` | Modo SSL (`disable`) |
| `JWT_SECRET` | Secret `iam-db-secret` | Clave para firmar/verificar JWT |

### Variables de Catalog (`catalog-db-config` / `catalog-db-secret`)

| Variable | Fuente K8s | Descripción |
|----------|-----------|-------------|
| `DB_HOST` | ConfigMap `catalog-db-config` | Host de PostgreSQL (`postgres-catalog`) |
| `DB_PORT` | ConfigMap `catalog-db-config` | Puerto de PostgreSQL (`5432`) |
| `GRPC_PORT` | ConfigMap `catalog-db-config` | Puerto del servidor gRPC (`50052`) |
| `HTTP_PORT` | ConfigMap `catalog-db-config` | Puerto del servidor HTTP / gRPC-Gateway (`8082`) |
| `DB_USER` | Secret `catalog-db-secret` | Usuario de PostgreSQL |
| `DB_PASSWORD` | Secret `catalog-db-secret` | Password de PostgreSQL |
| `DB_NAME` | Secret `catalog-db-secret` | Nombre de la base de datos (`catalog_db`) |
| `DB_SSLMODE` | Secret `catalog-db-secret` | Modo SSL (`disable`) |
| `JWT_SECRET` | Secret `iam-db-secret` | Clave JWT compartida desde el secreto de IAM |

### Variables de Orders (`orders-db-config` / `orders-db-secret`) *(ConfigMap y Secret pendientes de crear)*

| Variable | Fuente K8s | Descripción |
|----------|-----------|-------------|
| `DB_HOST` | ConfigMap `orders-db-config` (pendiente) | Host de PostgreSQL (`postgres-orders`) |
| `DB_PORT` | ConfigMap `orders-db-config` (pendiente) | Puerto de PostgreSQL (`5432`) |
| `GRPC_PORT` | ConfigMap `orders-db-config` (pendiente) | Puerto del servidor gRPC (`50053`) |
| `HTTP_PORT` | ConfigMap `orders-db-config` (pendiente) | Puerto del servidor HTTP / gRPC-Gateway (`8084`) |
| `DB_USER` | Secret `orders-db-secret` (pendiente) | Usuario de PostgreSQL |
| `DB_PASSWORD` | Secret `orders-db-secret` (pendiente) | Password de PostgreSQL |
| `DB_NAME` | Secret `orders-db-secret` (pendiente) | Nombre de la base de datos (`orders_db`) |
| `DB_SSLMODE` | Secret `orders-db-secret` (pendiente) | Modo SSL (`disable`) |
| `JWT_SECRET` | Secret `iam-db-secret` | Clave JWT compartida desde el secreto de IAM |

### Variables de Chat (`chat-db-config` / `chat-db-secret`) *(ConfigMap y Secret pendientes de crear)*

| Variable | Fuente K8s | Descripción |
|----------|-----------|-------------|
| `DB_HOST` | ConfigMap `chat-db-config` (pendiente) | Host de PostgreSQL (`postgres-chat`) |
| `DB_PORT` | ConfigMap `chat-db-config` (pendiente) | Puerto de PostgreSQL (`5432`) |
| `GRPC_PORT` | ConfigMap `chat-db-config` (pendiente) | Puerto del servidor gRPC (`50054`) |
| `HTTP_PORT` | ConfigMap `chat-db-config` (pendiente) | Puerto del servidor HTTP / gRPC-Gateway (`8085`) |
| `DB_USER` | Secret `chat-db-secret` (pendiente) | Usuario de PostgreSQL |
| `DB_PASSWORD` | Secret `chat-db-secret` (pendiente) | Password de PostgreSQL |
| `DB_NAME` | Secret `chat-db-secret` (pendiente) | Nombre de la base de datos (`chat_db`) |
| `DB_SSLMODE` | Secret `chat-db-secret` (pendiente) | Modo SSL (`disable`) |
| `JWT_SECRET` | Secret `iam-db-secret` | Clave JWT compartida desde el secreto de IAM |

## 10. Seguridad — Reglas del Repo

- `secret.yaml` está en `.gitignore` — NUNCA versionar secretos reales
- Solo se versiona `secret.example.yaml` con valores placeholder
- `.env` está en `.gitignore` — solo `.env.example` se versiona

## 11. CORS

CORS se maneja a nivel del **API Gateway Nginx** (`backend-go/k8s/gateway/configmap.yaml`).
El bloque `location /v1/auth/` responde preflight `OPTIONS` directamente (204) y añade
headers `Access-Control-Allow-*` en las respuestas proxy.

- **Origen permitido**: `https://marketplace-aalarcon.dev.censei.cl`
- **Métodos**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization
- **Credentials**: true

> Si se agrega un nuevo frontend o se cambia el dominio, actualizar `$cors_origin` en el ConfigMap
> y hacer `kubectl rollout restart deployment/api-gateway`.

## 12. Deuda Técnica Documentada

| Deuda | Archivo(s) afectado(s) | Acción requerida |
|-------|----------------------|------------------|
| ~~Catalog aún no desplegado~~ | ~~`backend-go/k8s/gateway/configmap.yaml`~~ | ✅ Resuelto — Manifiestos creados en `k8s/catalog/` y rutas `/v1/publications` y `/v1/categories` enrutadas en Nginx hacia `catalog:8082` |
| ~~CORS no configurado en el gateway~~ | ~~`backend-go/k8s/gateway/configmap.yaml`~~ | ✅ Resuelto — CORS inyectado en Nginx para `marketplace-aalarcon.dev.censei.cl` |
| TLS autofirmado | `backend-go/k8s/gateway/ingress.yaml`, `frontend-marketplace/k8s/ingress.yaml` | Agregar sección `tls` cuando el cluster tenga cert-manager. Mientras tanto, los navegadores mostrarán advertencia de certificado |
| Fallback JWT inseguro | `internal/service/auth_service.go`, `internal/middleware/jwt_interceptor.go` | Evaluar hacer panic en vez de usar clave de desarrollo si `JWT_SECRET` está vacía |
| Login y GetProfile devuelven datos mock | `internal/service/auth_service.go` | Confirmar si ya usan JWT real + GORM o siguen siendo stubs; bloquea validar HDU #238 de punta a punta |
| Media microservice | — | No implementado aún |
| CORS del Go sigue con localhost | `backend-go/cmd/iam/main.go` | `AllowedOrigins` solo tiene `localhost:3000` y `localhost:3001`. CORS de producción se maneja en Nginx, pero si se elimina el gateway habría que actualizar Go |
| ~~Tag `latest` en iam~~ | ~~`backend-go/k8s/iam/deployment.yaml`~~ | ✅ Resuelto — Migrado a tag único `20261006-5cdbdee` con `imagePullPolicy: IfNotPresent` |
| `catalog.exe` commiteado en repo | `backend-go/catalog.exe` | Eliminar ejecutable de Windows del control de versiones y verificar regla en `.gitignore` |
| Cookies con sameSite/expiración inconsistentes | `frontend-marketplace/src/lib/authCookies.ts`, `login-form.tsx`, `useAuthStore.ts` | `authCookies` usa `sameSite: 'strict'` (1 día de expiración) mientras `login-form` usa `document.cookie` con `SameSite=Lax` (7 días). Centralizar y homogeneizar atributos de cookies de sesión |
| Dos clientes HTTP en el frontend | `src/lib/axios.ts` y `src/lib/apiClient.ts` | Consolidar en un solo cliente para evitar inconsistencias de baseURL |
| ~~Catalog no valida JWT~~ | ~~`backend-go/cmd/catalog/main.go`~~ | ✅ Resuelto — Interceptor JWT registrado en Catalog; CreatePublication exige token y toma id_usuario_vendedor del contexto (spoofing corregido, commit d0b1f3e) |
| Exclusión de nodo agent-02 (nodeAffinity) | `backend-go/k8s/catalog/postgres-catalog.yaml` | Attach de volúmenes Cinder falla en `rke2-estudiantes-agent-02` (`FailedAttachVolume: "already attached to instances"`). Se agregó `nodeAffinity` con `NotIn` para excluir dicho nodo temporalmente; remover cuando el administrador del cluster lo resuelva |
| Manifiestos de Orders con dependencias pendientes | `backend-go/k8s/orders/` | Faltan `orders-db-config`, `orders-db-secret`, `postgres-orders` y reemplazo de `TAG_A_DEFINIR` por tag real antes de aplicar al clúster |
| Rutas de Orders y Chat no enrutadas en gateway | `backend-go/k8s/gateway/configmap.yaml` | Falta configurar `/v1/orders` en Nginx hacia `orders:8084`, así como rutas y CORS para Chat (`/v1/chat/*`) |
| ~~Chat sin manifiestos K8s (Deployment/Service)~~ | ~~`backend-go/k8s/chat/`~~ | ✅ Resuelto — Creados `deployment.yaml` y `service.yaml` en `k8s/chat/` |
| Manifiestos de Chat con dependencias pendientes | `backend-go/k8s/chat/` | Faltan `chat-db-config`, `chat-db-secret`, `postgres-chat` y reemplazo de `TAG_A_DEFINIR` por tag real antes de aplicar al clúster |
| Puertos y motor de base de datos de Chat | `backend-go/Dockerfile.chat`, `cmd/chat/main.go`, `docker-compose.yml` | Puertos 8085 (HTTP) y 50054 (gRPC) y motor PostgreSQL asumidos/adoptados en código; confirmar estabilidad y requerimientos definitivos al desplegar |
| orders y chat sin healthcheck en Compose | `docker-compose.yml` | Imágenes basadas en `scratch` no cuentan con shell ni `wget`; reintroducir healthcheck cuando los servicios expongan `/healthz` y se añada un mecanismo de auto-chequeo |
| wait-ports.js no verifica puertos de nuevos servicios | `scripts/wait-ports.js` | El script solo espera 5433, 5434, 8081, 8082 y 3000; no incluye 5435 (Media), 5436 (Chat DB), 5437 (Orders DB), 8083 (Media), 8084 (Orders) ni 8085 (Chat) porque los servicios son opcionales por perfil |
| Inconsistencia de scopes en GitFlow | `README.md` | `README.md` no lista `orders` ni `media` dentro de los scopes de GitFlow (`iam`, `catalog`, `chat`, etc.), pero la rama de #281 utilizó el scope `orders` por decisión del equipo |
| Alineación de puertos de base de datos del host | `docker-compose.yml`, `PROJECT_STRUCTURE.md` | Puerto host de `postgres_orders` se reasignó a `5437` para resolver colisión con `postgres_media` (`5435`); mantener `PROJECT_STRUCTURE.md` sincronizado |

## 13. GitFlow y Branching

<!-- TODO: documentar políticas de ramas, ver README.md -->

## 14. CI/CD (GitHub Actions)

El workflow `backend-go-ci.yml` ejecuta `make install-deps` y `make generate`,
lo que instala `protoc-gen-openapiv2` y genera los archivos Swagger JSON en
`api/openapi/` automáticamente junto con el código gRPC/Gateway.

El workflow `lint.yml` restringe su ejecución (mediante filtro `paths`) a cambios
dentro de `frontend-marketplace/**` y el propio archivo `.github/workflows/lint.yml`.
