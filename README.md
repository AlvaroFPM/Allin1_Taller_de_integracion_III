#  Políticas de Ramas y Convenciones (GitFlow)

Para asegurar la calidad y trazabilidad de nuestro código, este proyecto utiliza un modelo de Feature Branching enlazado a nuestro Tablero Ágil.

## 1. Nomenclatura de Ramas
Cada rama nueva debe llevar el prefijo del tipo de tarea, el número del ticket (Issue/HDU) y el microservicio que se está modificando.
**Formato:** `tipo/ID-microservicio-descripcion`
**Ejemplo:** `feat/12-catalog-crear-producto`

**Tipos permitidos:**
* `feat/`: Nueva funcionalidad.
* `fix/`: Corrección de bugs.
* `chore/`: Configuración, dependencias o tareas de DevOps.
* `docs/`: Cambios en documentación.

**Microservicios (Scopes):** `iam`, `catalog`, `search`, `reputation`, `support`, `chat`, `notify`, `payments`, `geo`, `match`, `front`.

## 2. Mensajes de Commit (Conventional Commits)
Los commits deben explicar qué se hizo y estar enlazados al ID de la tarea para dar contexto en el Code Review.
**Formato:** `tipo(#ID): mensaje descriptivo en imperativo`
**Ejemplo:** `feat(#12): agrega endpoint POST para creacion de productos en catalogo`

## 3. Reglas de Pull Requests (PR)
1. Está prohibido hacer push directo a `main`. Todo código pasa por un PR.
2. Todo PR debe utilizar la plantilla `.github/pull_request_template.md` (se carga sola).
3. Es OBLIGATORIO pegar el link del ticket de la HDU en la plantilla para dar contexto al revisor.
4. El PR requiere la aprobación de al menos 1 compañero (Code Review) antes de hacer Merge.

## Inicio rápido

### Requisitos previos
- **Windows:** GNU Make (`winget install ezwinports.make`) o ejecutar `setup.cmd`. Virtualización habilitada en BIOS/UEFI.
- **Linux:** `sudo apt install make` (o equivalente en tu distribución).
- **macOS:** GNU Make preinstalado (o vía Xcode CLI tools / Homebrew).

### Flujo de ejecución
1. **Instalar herramientas:** `make install-deps` (o doble clic en `setup.cmd` en Windows).
2. **Reiniciar sesión:** Cerrar y volver a abrir la terminal para actualizar el `PATH`.
3. **Levantar servicios:** `make up`

> **Nota Windows/WSL2:** Si WSL2 o Docker Desktop se acaban de instalar, reinicia el equipo antes de ejecutar `make up`.

### Comandos disponibles
| Comando             | Descripción                                                          |
|---------------------|----------------------------------------------------------------------|
| `make help`         | Lista todos los comandos disponibles con su descripción             |
| `make install-deps` | Instala Go, Node.js y Docker según el sistema operativo             |
| `make check`        | Diagnóstico del entorno y herramientas sin modificar nada            |
| `make up`           | Configura `.env`, levanta los contenedores y verifica disponibilidad |
| `make down`         | Detiene los contenedores de Docker de forma segura                  |
| `make logs`         | Muestra y sigue los logs de los contenedores en tiempo real          |
| `make ps`           | Muestra el estado actual de los contenedores                         |
| `make clean`        | Detiene contenedores y elimina volúmenes de base de datos            |
| `make proto`        | Genera código gRPC/Gateway (solo si modificas archivos `.proto`)    |

### Notas y solución de problemas
- **Puertos:** Con `make up`, IAM escucha en `http://localhost:8081` y Catalog en `http://localhost:8082` (el puerto 8080 en `.env.example` es para modo `go run`).
- **Docker:** Docker Desktop debe estar abierto y estable; si un puerto está ocupado, ejecuta `make down`.
- **Limpieza:** `make clean` detiene contenedores y borra los datos de las bases de datos locales.
- **Aviso frontend:** Si el build de `frontend-marketplace` falla con errores de TypeScript, es un problema conocido en `develop` ajeno a la infraestructura.
