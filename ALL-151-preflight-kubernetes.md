# ALL-151 — Comprobación previa de Kubernetes

Contexto `estudiante-aalarcon`, namespace `student-aalarcon`. Evidencia obtenida con `kubectl get` y `kubectl describe`.

- IAM, Catálogo, frontend y gateway aparecen en 1/1. No figuran Orders, su PostgreSQL ni Media en el inventario compartido.
- El Deployment de Catálogo declara HTTP 8082 y gRPC 50052. Los logs del Deployment confirmaron el arranque de ambos listeners. El Service activo solo expone HTTP 8082. El manifiesto que agrega gRPC 50052 pasó la validación de servidor en dry-run y queda por aplicar y comprobar a través del Service.
- Quedan disponibles 475m de CPU solicitada, 256Mi de RAM solicitada, 450m de límite de CPU, 512Mi de límite de RAM y un PVC. El borrador de Orders y su base requiere en total 200m y 384Mi de solicitudes, 500m y 1024Mi de límites y un PVC de 1Gi.
- Para el borrador faltan 50m de límite de CPU, 128Mi de solicitud de RAM y 512Mi de límite de RAM. Esa diferencia solo cubre el arranque en estado estable. Hay que reservar margen para actualización de pods y cualquier réplica adicional.
- LimitRange por contenedor. CPU entre 25m y 500m, memoria entre 64Mi y 512Mi. Los recursos del borrador cumplen los límites individuales y exceden la cuota agregada del namespace.

## Qué queda preparado

| Componente | Compose local | Kubernetes |
| --- | --- | --- |
| IAM | HTTP host 8081, contenedor 8080. PostgreSQL en `postgres_iam:5432`. | `iam:8080`, PostgreSQL con PVC existente, ruta `/v1/auth`. |
| Catálogo | HTTP host 8082, contenedor 8080, gRPC `catalog:50051`. PostgreSQL en `postgres_catalog:5432`. | HTTP `catalog:8082`, gRPC previsto en `catalog:50052`, PostgreSQL con PVC existente. Rutas de publicaciones y categorías. |
| Orders | Perfil `orders`, HTTP 8084, gRPC 50053, DB `postgres_orders:5432` con volumen nombrado. | Nuevo ConfigMap y PostgreSQL `postgres-orders:5432` con PVC de 1Gi. El gateway dispone del enrutamiento `/v1/orders` y `/v1/ordenes` en el repo. |
| Frontend | HTTP 3000. URLs de IAM, Catálogo, Orders y Media al compilar. | Compilar las URLs públicas de IAM, Catálogo y Orders con la URL HTTPS del gateway institucional. |
| Media | Perfil `media`. HTTP local 8083, base con volumen nombrado y credenciales Cloudinary propias. | Pendiente de configuración, ruta y capacidad de almacenamiento. |

Orders comparte el JWT de IAM mediante `iam-db-secret` en Kubernetes y `JWT_SECRET` en Compose. La BD de Kubernetes usa `orders-db-secret` con las claves `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `DB_SSLMODE`. Se debe sustituir `TAG_A_DEFINIR` por la imagen candidata publicada. Chat queda como complemento.

## Verificar Compose

```powershell
docker compose --profile orders config --quiet
docker compose --profile orders up -d --build
docker compose --profile orders ps
```

El archivo `.env` debe incluir las contraseñas de las bases activas y un JWT compartido. Para Media, completar también `POSTGRES_PASSWORD_MEDIA` y las tres variables `CLOUDINARY_*` antes de agregar `--profile media`. Si los volúmenes locales ya están inicializados, usar las credenciales existentes.

Abrir el frontend, iniciar sesión, consultar Catálogo y contratar una publicación válida. Confirmar compras o ventas según la cuenta y verificar que la orden siga disponible después de reiniciar únicamente el servicio Orders.

## Verificar Kubernetes

1. Acordar la capacidad para Orders y su base. Los déficits indicados arriba son mínimos y corresponden al estado estable.
2. Confirmar que el Catálogo candidato escucha en `50052` y validar el Service del repo en el servidor. Tras aplicar la configuración durante el despliegue coordinado, comprobar los endpoints.
3. Validar los manifiestos que se desplegarán, con la imagen candidata y los secretos disponibles, antes de aplicarlos. Comprobar PVC `Bound`, pods listos y una contratación real por el gateway.

```powershell
kubectl --context estudiante-aalarcon -n student-aalarcon apply --dry-run=server -f backend-go/k8s/catalog/service.yaml
kubectl --context estudiante-aalarcon -n student-aalarcon get endpointslice -l kubernetes.io/service-name=catalog
```

### Diagnóstico previo desde PowerShell

```powershell
$k = @('--context', 'estudiante-aalarcon', '-n', 'student-aalarcon')
kubectl @k describe resourcequota student-provisioner-quota
kubectl @k top pods --containers
kubectl @k logs deployment/catalog --tail=150 | Select-String 'gRPC|50052'
kubectl @k apply --dry-run=server -f backend-go/k8s/catalog/service.yaml
kubectl @k apply --dry-run=server -f backend-go/k8s/orders/configmap.yaml -f backend-go/k8s/orders/postgres-orders.yaml
```

Con el consumo observado, el arranque de Orders y de su PostgreSQL requiere una cuota total de al menos `1216Mi` en `requests.memory`, `3136Mi` en `limits.memory` y `2050m` en `limits.cpu`. Estos valores cubren el estado estable y deben recalcularse si cambia el consumo. La cuota adicional para rollouts depende de qué Deployments se actualicen y su estrategia. El uso de `kubectl top` es una foto reciente y no basta por sí solo para dimensionar límites.

El dry-run del StatefulSet valida su admisión como recurso, pero no demuestra que sus pods quepan en la cuota. Tampoco comprueba que el PVC pueda aprovisionarse ni que los contenedores arranquen. La evidencia final requiere el despliegue efectivo y verificación de sus rutas.

## Evidencia y pendientes

- Pasó la validación estática de Compose para Orders y Orders con Media en el borrador temporal. El borrador de Kubernetes se renderizó con Kustomize.
- Pasaron las pruebas de Media y del middleware y compiló el paquete de arranque de Orders.
- En la rama `infra/ALL-151-mvp-persistencia-y-rutas`, `git diff --check` y `docker compose --profile orders config --quiet` no emitieron errores en la salida compartida. Compose construyó las cuatro imágenes del núcleo y levantó IAM, Catálogo, Orders y el frontend. Los tres PostgreSQL aparecieron como `healthy` y se creó el volumen nombrado de Orders.
- Compose avisó de contenedores huérfanos de ejecuciones anteriores. El arranque del núcleo continuó. Media y Chat no formaron parte de esta ejecución.
- Compose, base `7e44a81` más los cambios locales de ALL-151. La prueba de contratación desde el frontend local dejó una orden visible en `/ordenes`, pestaña Mis Compras. Un nuevo intento para la misma publicación mostró el conflicto por orden activa.
- Antes y después de `docker compose --profile orders restart orders`, `GET /v1/orders/mis-compras` devolvió la orden **#2**, publicación **#47**, estado **PENDIENTE**, precio **12000 CLP**. También se confirmó en Mis Compras después del reinicio. El contenedor Orders volvió a quedar `Up` y PostgreSQL siguió `healthy`.
- El servidor aceptó en dry-run el Service de Catálogo, el ConfigMap de Orders y el PVC, Service y StatefulSet de PostgreSQL. La cuota mantiene los mismos valores del inventario inicial. `kubectl top pods --containers` devolvió `Forbidden` para `pods.metrics.k8s.io`, por lo que no hubo métricas para justificar una reducción de recursos.
- Quedan pendientes la capacidad para los pods, una imagen candidata de Orders, la validación de su Deployment y el despliegue y las pruebas por el gateway. El dry-run anterior no creó recursos.
