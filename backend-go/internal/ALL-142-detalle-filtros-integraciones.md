# ALL-142 — Comprobación de detalle y filtros consumidos por las integraciones (Catálogo)

- **Responsable:** Nicolás
- **Presupuesto:** 1 punto (1 hora)
- **Rama de trabajo:** `test/142-catalog-comprobar-detalle-filtros`
- **Base de comparación:** `develop` en `edd6010`
- **Dependencia evaluada:** `ALL-130` (pendiente de merge en `develop`; para esta comprobación se importó temporalmente `publication_service.go` desde `refactor/130-catalog-simplificar-codigo` sin incluirlo en el commit de esta rama).

## 1. Estado de dependencias y alcance

- El código refactorizado de `ALL-130` (`backend-go/internal/service/publication_service.go`) aún no está fusionado en `develop`, por lo que se validó localmente sobre una copia de trabajo manteniendo el PR de `ALL-142` acotado exclusivamente a evidencia documental.
- No se modificaron contratos `.proto`, archivos generados en `internal/api/pb/`, esquemas GORM ni reglas de negocio.
- No se añadieron nuevas pruebas en `publication_service_test.go` al no detectarse defectos funcionales dentro del alcance; la ausencia de prueba automática específica para el filtro `user_id` permanece registrada como observación de cobertura (lista B de `ALL-129`).

## 2. Verificación con pruebas reales contra PostgreSQL (`catalog_db`)

Comando ejecutado sin caché contra el contenedor `postgres_catalog` (`localhost:5434`, base `catalog_db`):

```powershell
go test -v -count=1 ./internal/service/... -run "TestGetPublication|TestListPublications"