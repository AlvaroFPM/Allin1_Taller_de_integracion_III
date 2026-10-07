# ==============================================================================
# Allin1 - Makefile de Automatizacion Multiplataforma (Windows / Linux / macOS)
# ==============================================================================
# Este Makefile proporciona un flujo estandarizado e idempotente para instalar
# dependencias, diagnosticar el entorno y levantar los servicios con Docker.
#
# Flujo en 2 fases:
#   1. Fase de instalacion de herramientas:
#        make install-deps
#      -> Cerrar y volver a abrir la terminal para actualizar el PATH.
#   2. Fase de ejecucion:
#        make up
#      -> Configura .env, levanta Docker Compose y verifica puertos disponibles.
#
# En entornos con herramientas ya instaladas:
#   make setup  (ejecuta: env -> deps -> up)
# ==============================================================================

.DEFAULT_GOAL := help

.PHONY: help install-deps check env deps up down ps logs restart clean proto setup

# ------------------------------------------------------------------------------
# Deteccion de Sistema Operativo y configuracion de Shell
# ------------------------------------------------------------------------------
ifeq ($(OS),Windows_NT)
DETECTED_OS := Windows
SHELL := cmd.exe
.SHELLFLAGS := /C
WAIT_PORTS_CMD := node scripts/wait-ports.js 5433 5434 8081 8082 3000 || (docker compose ps && exit /b 1)
else
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
DETECTED_OS := Linux
else ifeq ($(UNAME_S),Darwin)
DETECTED_OS := macOS
else
DETECTED_OS := Unix
endif
SUDO := $(if $(filter 0,$(shell id -u)),,sudo)
ARCH := $(shell uname -m | sed -e 's/x86_64/amd64/' -e 's/aarch64/arm64/')
WAIT_PORTS_CMD := node scripts/wait-ports.js 5433 5434 8081 8082 3000 || (docker compose ps && exit 1)
endif

# ------------------------------------------------------------------------------
# Targets Principales
# ------------------------------------------------------------------------------

help: ## Muestra la lista de comandos disponibles
	@echo ====================================================================
	@echo   Allin1 - Comandos disponibles ($(DETECTED_OS))
	@echo ====================================================================
	@echo   make help          - Muestra esta lista de comandos
	@echo   make install-deps  - Instala Go, Node y Docker si faltan
	@echo   make check         - Diagnostico de herramientas sin modificar nada
	@echo   make env           - Genera o completa el archivo .env
	@echo   make deps          - Descarga dependencias locales (Go mod y npm)
	@echo   make up            - Configura .env, levanta Docker y espera puertos
	@echo   make down          - Detiene los contenedores de Docker
	@echo   make ps            - Muestra el estado de los contenedores
	@echo   make logs          - Muestra los logs en tiempo real
	@echo   make restart       - Reinicia los contenedores
	@echo   make clean         - Detiene contenedores y elimina volumenes (BD)
	@echo   make proto         - Genera codigo gRPC (solo si modificas .proto)
	@echo   make setup         - Flujo completo local: env + deps + up
	@echo ====================================================================

check: ## Diagnostico de herramientas y variables sin modificar nada
	@echo ====================================================================
	@echo   Diagnostico de herramientas locales ($(DETECTED_OS))
	@echo ====================================================================
	-go version
	-node -v
	-npm -v
	-docker --version
	-docker compose version
	-docker info
	-node scripts/gen-env.js --check
	-node -e "const [maj,min]=process.versions.node.split('.').map(Number); if(maj<20 || (maj===20 && min<9)){ console.error('[WARN] Node >= 20.9 requerido. Actual: '+process.version); process.exit(1); } else { console.log('[OK]   Node >= 20.9 cumplido ('+process.version+')'); }"
	@echo ====================================================================

env: ## Genera o completa las variables de entorno en .env
	node scripts/gen-env.js

up: env ## Configura .env, levanta contenedores y espera disponibilidad de puertos
	docker compose up -d --build
	@$(WAIT_PORTS_CMD)
	@echo ====================================================================
	@echo   Allin1 esta corriendo exitosamente!
	@echo ====================================================================
	@echo   Frontend Marketplace: http://localhost:3000
	@echo   IAM REST API:         http://localhost:8081
	@echo   Catalog REST API:     http://localhost:8082
	@echo   PostgreSQL IAM:       localhost:5433
	@echo   PostgreSQL Catalog:   localhost:5434
	@echo ====================================================================

ps: ## Muestra el estado de los contenedores
	docker compose ps

logs: ## Muestra y sigue los logs de todos los contenedores en tiempo real
	docker compose logs -f

restart: ## Reinicia los contenedores de Docker
	docker compose restart

proto: ## Genera codigo gRPC/Gateway (solo si modificas .proto; los .pb ya estan en Git)
	$(MAKE) -C backend-go generate

setup: env deps up ## Alias para inicializar y levantar el proyecto: env + deps + up

# ------------------------------------------------------------------------------
# Recetas especificas por Plataforma (install-deps, deps, down, clean)
# ------------------------------------------------------------------------------
ifeq ($(OS),Windows_NT)

install-deps: ## Instala Go, Node y Docker si faltan en Windows via winget y verifica WSL2
	@where go >nul 2>&1 || (echo [INFO] Instalando GoLang... && winget install --id GoLang.Go -e --silent --accept-package-agreements --accept-source-agreements)
	@where node >nul 2>&1 || (echo [INFO] Instalando Node.js LTS... && winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements)
	@where docker >nul 2>&1 || (echo [INFO] Instalando Docker Desktop... && winget install --id Docker.DockerDesktop -e --silent --accept-package-agreements --accept-source-agreements)
	@wsl --status >nul 2>&1 || (echo [INFO] WSL2 no detectado. Instalando WSL2... && wsl --install --no-distribution && echo [AVISO] Reinicia el equipo para completar la instalacion de WSL2)
	@echo.
	@echo [OK] Verificacion de dependencias finalizada.
	@echo [IMPORTANTE] Cierra y vuelve a abrir la terminal (el PATH cambio) y ejecuta: make up
	@echo Si Docker Desktop o WSL2 requieren reiniciar Windows, reinicia el equipo antes de continuar.

deps: ## Descarga dependencias locales del backend y frontend (no fatal)
	-cd /d backend-go && go mod download || echo [WARN] Error descargando modulos Go. El build real ocurre dentro de Docker.
	-cd /d frontend-marketplace && npm ci || echo [WARN] Error instalando dependencias Node. El build real ocurre dentro de Docker.

down: ## Detiene los contenedores de forma segura
	@docker info >nul 2>&1 && docker compose down || echo [WARN] Docker no esta corriendo; nada que bajar.

clean: ## Detiene contenedores y elimina volumenes asociados (se pierden datos de BD)
	@echo [AVISO] Eliminando contenedores y volumenes de datos (se borraran las BD locales)...
	docker compose down -v

else

install-deps: ## Instala Go, Node y Docker si faltan en Linux o macOS
ifeq ($(DETECTED_OS),macOS)
	@command -v go >/dev/null 2>&1 || (echo "[INFO] Instalando Go via Homebrew..." && brew install go)
	@command -v node >/dev/null 2>&1 || (echo "[INFO] Instalando Node.js 22 via Homebrew..." && brew install node@22)
	@command -v docker >/dev/null 2>&1 || (echo "[INFO] Instalando Docker Desktop via Homebrew..." && brew install --cask docker)
else
	@command -v go >/dev/null 2>&1 || ( \
		echo "[INFO] Descargando Go 1.27.1 oficial desde go.dev..." && \
		curl -fsSL https://go.dev/dl/go1.27.1.linux-$(ARCH).tar.gz -o /tmp/go1.27.1.tar.gz && \
		$(SUDO) rm -rf /usr/local/go && \
		$(SUDO) tar -C /usr/local -xzf /tmp/go1.27.1.tar.gz && \
		rm -f /tmp/go1.27.1.tar.gz && \
		echo 'export PATH=$$PATH:/usr/local/go/bin' | $(SUDO) tee -a /etc/profile \
	)
	@command -v node >/dev/null 2>&1 || ( \
		echo "[INFO] Instalando Node.js 22 LTS via NodeSource..." && \
		if command -v apt-get >/dev/null 2>&1; then \
			curl -fsSL https://deb.nodesource.com/setup_22.x | $(SUDO) -E bash - && \
			$(SUDO) apt-get install -y nodejs; \
		elif command -v dnf >/dev/null 2>&1; then \
			curl -fsSL https://rpm.nodesource.com/setup_22.x | $(SUDO) bash - && \
			$(SUDO) dnf install -y nodejs; \
		fi \
	)
	@command -v docker >/dev/null 2>&1 || ( \
		echo "[INFO] Instalando Docker..." && \
		curl -fsSL https://get.docker.com | sh && \
		$(SUDO) systemctl enable --now docker \
	)
endif
	@echo ""
	@echo "[OK] Verificacion de dependencias finalizada."
	@echo "Cierra y vuelve a abrir la terminal (el PATH cambio) y ejecuta: make up"

deps: ## Descarga dependencias locales del backend y frontend (no fatal)
	-cd backend-go && go mod download || echo "[WARN] Error descargando modulos Go. El build real ocurre dentro de Docker."
	-cd frontend-marketplace && npm ci || echo "[WARN] Error instalando dependencias Node. El build real ocurre dentro de Docker."

down: ## Detiene los contenedores de forma segura
	@docker info >/dev/null 2>&1 && docker compose down || echo "[WARN] Docker no esta corriendo; nada que bajar."

clean: ## Detiene contenedores y elimina volumenes asociados (se pierden datos de BD)
	@echo "[AVISO] Eliminando contenedores y volumenes de datos (se borraran las BD locales)..."
	docker compose down -v

endif
