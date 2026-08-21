# 🌿 Políticas de Ramas y Convenciones (GitFlow)

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
