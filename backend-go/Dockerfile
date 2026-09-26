# ==============================================================================
# Dockerfile Multi-Stage para Microservicios en Go (Monorepo Clean Architecture)
# ==============================================================================
# Este Dockerfile está diseñado para ser reutilizable por cualquiera de los
# microservicios ubicados en cmd/<microservicio> (iam, catalog, media, etc.).
# Recibe el argumento de construcción SERVICE_PATH (ej: cmd/iam).
# ==============================================================================

# ==============================================================================
# ETAPA 1: Builder (Compilación y generación de binario estático)
# ==============================================================================
# Usamos una imagen de Go basada en Alpine Linux para compilar.
# Alpine es liviana (~300MB) pero contiene las herramientas necesarias del SDK de Go.
FROM golang:1.27-alpine AS builder

# Argumento para especificar qué microservicio compilar dentro del monorepo.
# Por defecto se establece 'cmd/iam', pero puede sobreescribirse al hacer el build:
# --build-arg SERVICE_PATH=cmd/catalog
ARG SERVICE_PATH=cmd/iam

# Instalamos ca-certificates y tzdata en el builder:
# 1. ca-certificates: Certificados SSL/TLS raíz para permitir conexiones seguras
#    a bases de datos (PostgreSQL TLS/SSL) o APIs externas HTTPS.
# 2. tzdata: Información de zonas horarias para manejo correcto de fechas/horas en Go.
RUN apk --no-cache add ca-certificates tzdata

# Establecemos el directorio de trabajo dentro del contenedor builder.
WORKDIR /app

# OPTIMIZACIÓN DE CAPAS (Layer Caching):
# Copiamos primero únicamente los archivos de definición de dependencias.
# Docker guardará esta capa en caché; solo se re-ejecutará 'go mod download'
# si go.mod o go.sum cambian, acelerando drásticamente builds posteriores.
COPY go.mod go.sum ./
RUN go mod download

# Copiamos todo el código fuente del módulo Go (cmd/, internal/, api/, etc.).
COPY . .

# COMPILACIÓN DEL BINARIO ESTÁTICO:
# - CGO_ENABLED=0: Deshabilita el enlace con librerías C (cgo). Esto produce un
#   binario 100% estático e independiente que NO requiere ninguna librería compartida
#   dinámica del sistema operativo (libc, musl, glibc ni dynamic linkers).
#   Esto es lo que permite ejecutar el binario directamente sobre 'scratch'.
# - GOOS=linux: Garantiza que el binario sea ejecutable en contenedores Linux,
#   incluso si se compila desde Windows o macOS.
# - -ldflags="-w -s":
#     * -w: Deshabilita la generación de información de depuración DWARF.
#     * -s: Elimina la tabla de símbolos del binario.
#   Ambos flags reducen significativamente el peso del binario final (~20-30% menos)
#   sin afectar en absoluto el rendimiento o funcionamiento en producción.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/bin/service ./${SERVICE_PATH}

# ==============================================================================
# ETAPA 2: Final / Runtime (Imagen ultra liviana y segura)
# ==============================================================================
# Usamos 'scratch' como imagen base. 'scratch' es una imagen vacía de 0 bytes (no contiene
# sistema operativo, ni shell, ni paquetes superfluos).
#
# ¿Por qué 'scratch' en lugar de 'alpine'?
# 1. Tamaño mínimo: La imagen resultante pesa únicamente lo que pesa el binario compilado
#    (~13 MB) más los certificados CA (~200 KB), logrando una reducción de >98% comparado
#    con una imagen Go estándar (~1 GB) y menor que Alpine (~20 MB).
# 2. Máxima seguridad: Al no existir shell (sh/bash) ni gestor de paquetes (apk) ni utilidades
#    del SO, la superficie de ataque y las vulnerabilidades (CVEs) se reducen a prácticamente cero.
FROM scratch

# Copiamos los certificados SSL/TLS raíz desde la etapa 'builder'.
# Esto es fundamental para que librerías como GORM con pgx o clientes HTTP
# puedan validar certificados TLS al conectar con PostgreSQL o servicios externos.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copiamos la información de zonas horarias para manipulación de timestamps (time.Location).
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copiamos ÚNICAMENTE el binario estático compilado desde la etapa 'builder'.
COPY --from=builder /app/bin/service /service

# EXPOSE: Puertos de comunicación del microservicio.
# - 50051: Puerto gRPC nativo (servidor gRPC inicializado en main.go).
# - 8080:  Puerto REST del gRPC-Gateway (proxy HTTP -> gRPC, también inicializado en main.go).
EXPOSE 50051
EXPOSE 8080

# ENTRYPOINT: Ejecuta directamente el binario compilado como proceso principal (PID 1).
# No usamos 'go run' (que es solo para desarrollo y requiere el SDK completo),
# sino el binario nativo optimizado para producción.
ENTRYPOINT ["/service"]
