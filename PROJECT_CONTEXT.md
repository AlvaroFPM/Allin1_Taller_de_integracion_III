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
| Catalog  | 50051      | 8080                 | Publicaciones del marketplace |
| Media    | —          | —                    | Gestión de imágenes (pendiente) |
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
          → /v1/auth/*    → Service iam:8080     → Pod IAM (Go)
          → /v1/catalog/* → Service catalog:8082  → Pod Catalog (Go)  [pendiente]
          → /*            → 404 JSON
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
- Passwords de PostgreSQL vía `${POSTGRES_PASSWORD_IAM}` y `${POSTGRES_PASSWORD_CATALOG}`
- Ver `.env.example` para la lista completa de variables

## 7. Convenciones de Naming

- Labels Kubernetes: `app`, `project: allin1`, `tier: backend|frontend`
- Namespace: `student-aalarcon`
- Secretos K8s: `<servicio>-db-secret` (ej. `iam-db-secret`)
- Imágenes Docker Hub: `am4roo/allin1-<servicio>-<stack>:<tag>`
  - Ejemplo backend: `am4roo/allin1-iam-go:latest`
  - Ejemplo frontend: `am4roo/allin1-frontend-next:20260929-b373523`
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

> **IMPORTANTE — NEXT_PUBLIC_API_URL es variable de BUILD**:
> Está inlineada en el bundle JS durante `npm run build`. Para cambiarla
> hay que reconstruir la imagen Docker con el nuevo `--build-arg` y subir
> un tag nuevo. NO se inyecta como env en el Deployment.

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

| Variable | Fuente K8s | Descripción |
|----------|-----------|-------------|
| `DB_HOST` | ConfigMap `iam-db-config` | Host de PostgreSQL |
| `DB_PORT` | ConfigMap `iam-db-config` | Puerto de PostgreSQL |
| `DB_USER` | Secret `iam-db-secret` | Usuario de PostgreSQL |
| `DB_PASSWORD` | Secret `iam-db-secret` | Password de PostgreSQL |
| `DB_NAME` | Secret `iam-db-secret` | Nombre de la base de datos |
| `DB_SSLMODE` | Secret `iam-db-secret` | Modo SSL |
| `JWT_SECRET` | Secret `iam-db-secret` | Clave para firmar/verificar JWT |

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
| Catalog aún no desplegado | `backend-go/k8s/gateway/configmap.yaml` | Descomentar `location /v1/catalog/` cuando exista el Service |
| ~~CORS no configurado en el gateway~~ | ~~`backend-go/k8s/gateway/configmap.yaml`~~ | ✅ Resuelto — CORS inyectado en Nginx para `marketplace-aalarcon.dev.censei.cl` |
| TLS autofirmado | `backend-go/k8s/gateway/ingress.yaml`, `frontend-marketplace/k8s/ingress.yaml` | Agregar sección `tls` cuando el cluster tenga cert-manager. Mientras tanto, los navegadores mostrarán advertencia de certificado |
| Fallback JWT inseguro | `internal/service/auth_service.go`, `internal/middleware/jwt_interceptor.go` | Evaluar hacer panic en vez de usar clave de desarrollo si `JWT_SECRET` está vacía |
| Login y GetProfile devuelven datos mock | `internal/service/auth_service.go` | Confirmar si ya usan JWT real + GORM o siguen siendo stubs; bloquea validar HDU #238 de punta a punta |
| Media microservice | — | No implementado aún |
| CORS del Go sigue con localhost | `backend-go/cmd/iam/main.go` | `AllowedOrigins` solo tiene `localhost:3000` y `localhost:3001`. CORS de producción se maneja en Nginx, pero si se elimina el gateway habría que actualizar Go |
| Tag `latest` en iam | `backend-go/k8s/iam/deployment.yaml` | Migrar a tags únicos (`YYYYMMDD-<hash>`) como el frontend |
| Dos clientes HTTP en el frontend | `src/lib/axios.ts` y `src/lib/apiClient.ts` | Consolidar en un solo cliente para evitar inconsistencias de baseURL |

## 13. GitFlow y Branching

<!-- TODO: documentar políticas de ramas, ver README.md -->

## 14. CI/CD (GitHub Actions)

<!-- TODO: documentar workflows de CI, protoc, build, etc. -->
