# ALL-143 — Evidencia de conexión de confirmación con creación real de órdenes

- **Responsable:** Francisco Barriga (`francisco879`).
- **Presupuesto planificado:** 2 puntos / 2 horas; no equivale a tiempo de ejecución acreditado.
- **Rama:** `docs/ALL-143-front-evidencia-creacion-ordenes`.
- **Base actual del documento:** `develop` en `9f81985`.
- **Fecha de las comprobaciones reportadas:** 17-11-2026.
- **Estado:** evidencia parcial de integración local; pendiente de completar las verificaciones de cierre.
- **Ticket:** https://linear.app/allin1/issue/ALL-143
- **Dependencias:** ALL-138 y ALL-141 integradas en la base revisada.

La preparación inicial comenzó con la carpeta en `c0627f2`; posteriormente se actualizó a `9f81985`. No se conservó una asociación verificable entre cada imagen local y su commit de construcción. No se atribuye automáticamente la prueba histórica a `9f81985`: actualizar Git no reconstruye los contenedores. Una nueva ejecución debe registrar commit, cambios locales e imágenes utilizadas.

Esta entrega documenta el flujo existente; no incorpora código de aplicación ni habilita el despliegue público. Añadir el enlace al PR y el commit de entrega cuando existan.

## 1. Entorno local

| Componente | Dirección utilizada |
| --- | --- |
| Frontend | `http://localhost:3000`, con `npm run dev` |
| IAM HTTP | `localhost:8081` → contenedor `iam:8080` |
| Catálogo HTTP | `localhost:8082` → contenedor `catalog:8080` |
| Catálogo gRPC | `catalog:50051`, dentro de Compose; sin puerto publicado al host |
| Orders HTTP / gRPC | `localhost:8084` / puerto interno `50053` |
| PostgreSQL | Bases locales `iam_db`, `catalog_db`, `orders_db` |

Orders se inició con `ORDERS_ENABLE_CREATION=true` y `CATALOG_GRPC_ADDR=catalog:50051` mediante un archivo temporal fuera del repositorio. Las credenciales provienen del `.env` local ignorado por Git. No se incluyen secretos en esta evidencia.

## 2. Creación y persistencia observadas

**Fuente:** resultados del navegador y PowerShell aportados por Francisco durante la comprobación guiada.

1. Abrió el modal y pulsó **Cancelar**. No observó un POST de creación en Network.
2. Posteriormente confirmó la contratación de la publicación `52` con el comprador `2`.
3. Network mostró `POST http://localhost:8084/v1/orders`, con respuesta **200 OK**.
4. Compartió esta respuesta:

```json
{
  "order": {
    "idOrden": 1,
    "idUsuarioComprador": 2,
    "idUsuarioVendedor": 1,
    "idPublicacion": 52,
    "estado": "PENDIENTE",
    "estadoStr": "PENDIENTE",
    "precio": "222000",
    "createdAt": "2026-11-17T22:20:01.919179824Z",
    "updatedAt": "2026-11-17T22:20:01.919179824Z"
  },
  "message": "Orden creada exitosamente"
}
```

5. Ejecutó esta consulta de solo lectura:

```powershell
docker exec postgres_orders psql -U postgres -d orders_db -c "SELECT id_orden, id_usuario_comprador, id_usuario_vendedor, id_publicacion, precio, estado FROM ordenes WHERE id_orden = 1;"
```

Resultado compartido: **una fila**, con los siguientes valores:

| id_orden | id_usuario_comprador | id_usuario_vendedor | id_publicacion | precio | estado |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 52 | 222000 | PENDIENTE |

La coincidencia demuestra persistencia local para este caso. Por sí sola no demuestra el rechazo de usuarios no autorizados o datos manipulados.

**Rechazo real de orden duplicada (RN-22):** Francisco volvió a confirmar la contratación de la publicación `52` como comprador `2`. Network mostró `POST http://localhost:8084/v1/orders` → **409 Conflict** y la respuesta `{"code":6,"message":"ya tienes una orden en curso para esta publicación (RN-22)","details":[]}`. Luego ejecutó:

```powershell
docker exec postgres_orders psql -U postgres -d orders_db -c "SELECT id_orden, estado FROM ordenes WHERE id_usuario_comprador = 2 AND id_publicacion = 52 ORDER BY id_orden;"
```

La consulta devolvió **una sola fila**, `id_orden = 1`, `estado = PENDIENTE`. Esto comprueba el rechazo y la ausencia de una segunda fila para esa pareja comprador/publicación. No se conservó una comprobación explícita del mensaje mostrado en pantalla durante este 409.

**Interfaz:** Francisco reportó «Acción no disponible» después de contratar. El código define el mensaje `Orden {createdOrderId} creada correctamente`, pero su visualización y el cierre automático del modal no cuentan con confirmación manual explícita en la evidencia conservada. Tampoco se registró una prueba manual de Escape.

**Entrada reconstruida por inspección:** la página y `orderService.ts` construyen `idUsuarioVendedor`, `idPublicacion` y `precio`; para este caso corresponden a `1`, `52` y `"222000"`. No se conserva una captura del payload enviado. El comprador se obtiene en el backend del contexto autenticado, no de un campo comprador del request.

## 3. Clasificación de las comprobaciones

| Comprobación | Evidencia y alcance |
| --- | --- |
| Cancelar mediante el botón | Observación manual: ningún POST. No extender a Escape. |
| Creación y persistencia | Respuesta HTTP y resultado SQL reproducidos en la sección 2. |
| Orden activa duplicada (RN-22) | POST real respondió 409; SQL posterior mostró solo la orden 1. No se verificó explícitamente el aviso de error en pantalla. |
| Fallo de red en el frontend | Francisco activó el modo Offline en Network con el detalle previamente cargado e intentó confirmar. Observó «No pudimos confirmar la creación. Comprueba tus órdenes antes de reintentar para evitar duplicados.». Después de volver a estar online, ejecutó `SELECT id_orden, estado FROM ordenes WHERE id_usuario_comprador = 2 AND id_publicacion = 52 ORDER BY id_orden;` y obtuvo una sola fila: orden 1, PENDIENTE. No aportó el estado de Network; no se atribuye un código HTTP a esta prueba. |
| Doble envío | Test con mocks: dos invocaciones concurrentes de `onConfirm` producen una llamada al servicio. No demuestra dos clics reales ni idempotencia del backend. |
| Publicación propia y DEMANDA | Pruebas con mocks de los bloqueos de la página. Rechazo real de autocontratación pendiente de registrar. |
| HTTP 400, 401, 403, 409 y 500 | Simulados en la suite de la página; no ejecutan todo el recorrido de Axios, navegador y backend. |
| Respuesta sin ID válido | Pruebas defensivas del cliente y página con respuestas simuladas. |
| GET de publicación 52 y POST sin token | Antigravity reportó GET 200 y POST 401. La salida completa no está adjunta: conservar como evidencia reportada, pendiente de adjuntar o repetir. |

Por inspección de `src/lib/axios.ts`, un 401 limpia cookies y el store y redirige a `/login?session=expired`. No es correcto afirmar que el navegador real permanece en el modal porque así ocurra en una prueba con mocks.

`src/app/login/page.tsx` activa el aviso con `expired=true`. El parámetro enviado por Axios no activa esa condición. Es un defecto identificado por inspección que afecta al aviso de autenticación; requiere resolución y comprobación antes de acreditar ese aspecto del cierre.

**Prueba manual de token inválido (reporte de Francisco):** al modificar localmente la cookie para provocar una sesión inválida y confirmar, observó un mensaje breve de «sesión expirada» durante aproximadamente un segundo y luego fue llevado a iniciar sesión. No se conservaron el estado HTTP de Network ni la URL final. Ese mensaje fugaz puede ser el del modal antes de la navegación; el reporte no demuestra que el aviso propio de login se muestre después de redirigir. No se anunció la creación de una orden en esta observación.

`src/components/shared/publication-detail-sidebar.tsx` muestra «Acción no disponible» cuando no hay `onAction`, aunque reciba `actionText="Orden creada"`. Esto explica la etiqueta reportada, pero no verifica el mensaje separado de éxito.

## 4. Procedimiento para repetir la integración

Estos pasos describen la preparación utilizada; no acreditan una nueva ejecución.

1. Abrir Docker Desktop y verificar `docker version` y `docker ps`.
2. En la raíz, registrar `git rev-parse HEAD` y `git status --short`. Revisar el `.env` existente sin regenerar credenciales indiscriminadamente. Durante la preparación se corrigió un rechazo de contraseña en IAM y Catálogo sincronizando las claves locales de PostgreSQL con el `.env`, sin borrar datos.
3. Si no se usa Media, asignar en PowerShell valores temporales para que Compose pueda interpretar sus variables obligatorias. No son credenciales reales ni permiten probar Media:

```powershell
$env:CLOUDINARY_CLOUD_NAME = "media-no-utilizado"
$env:CLOUDINARY_API_KEY = "media-no-utilizado"
$env:CLOUDINARY_API_SECRET = "media-no-utilizado"
docker compose --profile orders up -d --build iam catalog postgres_orders
```

4. Crear el archivo temporal fuera del repositorio:

```powershell
$ordersOverridePath = Join-Path $env:TEMP "allin1-orders-local.override.yaml"
@'
services:
  orders:
    environment:
      ORDERS_ENABLE_CREATION: "true"
      CATALOG_GRPC_ADDR: "catalog:50051"
'@ | Set-Content -LiteralPath $ordersOverridePath -Encoding utf8
docker compose -f docker-compose.yml -f "$ordersOverridePath" --profile orders up -d --build orders
docker ps -a
docker logs --tail 60 orders
docker inspect --format '{{.Name}} {{.Image}}' iam catalog orders
```

5. En otra terminal, desde `frontend-marketplace/`:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:8081"
$env:NEXT_PUBLIC_CATALOG_API_URL = "http://localhost:8082"
$env:NEXT_PUBLIC_ORDERS_API_URL = "http://localhost:8084"
npm run dev
```

6. Iniciar una sesión nueva y elegir una OFERTA activa de otro usuario. En Network → Fetch/XHR, comprobar cancelar sin POST; después confirmar una vez y registrar estado HTTP, respuesta y comportamiento visual, sin secretos.
7. Consultar PostgreSQL con el ID realmente devuelto. Los IDs `1` y `52` son históricos: no asumir que se repetirán. Para el caso nominal, usar una pareja comprador/publicación sin orden activa previa; de lo contrario puede activarse el rechazo de duplicado.

## 5. Comprobaciones automatizadas y procedencia

Comandos desde `frontend-marketplace/`:

| Comando | Resultado disponible |
| --- | --- |
| `node --test tests/order-service.test.mjs tests/purchase-flow.test.mjs` | Codex observó 16 PASS, 0 FAIL y Exit 0 durante la revisión inicial en `c0627f2`. Antigravity también reportó 16 PASS. No se reejecutó al editar este documento en `9f81985`. |
| `npm run lint` | Antigravity reportó Exit 0. Salida completa y commit exacto de ejecución no adjuntados. |
| `npm run build` | Antigravity reportó Exit 0, pero no se dispone aquí del registro verificable: pendiente de adjuntar o repetir. No se conservan tiempos ni número de rutas como evidencia confirmada. |

Esta edición documental no agrega pruebas ni declara corregido un defecto. Si se modifica código para resolver un fallo no cubierto, añadir la regresión correspondiente y registrar las comprobaciones de esa versión.

## 6. Criterios de aceptación y pendientes

| Criterio | Estado |
| --- | --- |
| Orden real con ID en la respuesta | Demostrado para la orden 1 en local. Completar la trazabilidad de las imágenes históricas o repetir en una base registrada. |
| Cancelar sin solicitudes y doble clic sin envíos simultáneos | Cancelación manual; concurrencia respaldada por test con mocks. Completar observación en navegador durante una solicitud pendiente. |
| Errores de autenticación, validación y red sin falso éxito | Parcial: cobertura simulada y 401 de API reportado. Faltan comprobaciones integradas y resolver el aviso de sesión expirada. |

Pendientes concretos:

- Observar y registrar estado de envío, mensaje de éxito y cierre del modal.
- Probar doble clic mientras la solicitud está pendiente y contar los POST reales.
- Comprobar token inválido o expirado, limpieza de sesión y aviso visible tras redirección; resolver el desfase de parámetros.
- Probar precio/vendedor manipulados y autocontratación contra Orders, comprobando que no se crean filas nuevas. Simular HTTP 400 no demuestra esas reglas.
- Si se requiere evidencia adicional del fallo de red, registrar el estado de Network; el mensaje de error y la ausencia de una segunda orden ya se comprobaron. Si se prueba Catálogo indisponible, registrar por separado su HTTP 503: un error de red del navegador no es un HTTP 500/503.
- Comprobar y registrar el aviso visible de conflicto para el 409 observado; el rechazo HTTP y la ausencia de una segunda fila ya se verificaron.
- Adjuntar resultados, identificar versiones y enlazar PR/commit. Registrar tiempo utilizado y replanificar lo pendiente si supera la capacidad.

**No se declara ALL-143 terminada con este documento.** La creación nominal no sustituye las verificaciones pendientes de errores y controles.

## 7. Coordinación y alcance separado

- **Kubernetes:** Catálogo está configurado para escuchar gRPC en `50052`, pero su Service actual solo expone HTTP. Coordinar exposición gRPC, `CATALOG_GRPC_ADDR=catalog:50052` y habilitación de Orders con infraestructura. Esta prueba no acredita el despliegue público.
- **Etiqueta del botón:** «Orden creada» podría comunicar mejor el resultado. Tratar como mejora separada si el mensaje de éxito existente resulta suficiente; no declarar implementado el ajuste.
- **DEMANDA:** permanece bloqueada en UI hasta definir los roles con el equipo.
- **GetOrder:** permanece sin implementar. La persistencia se verificó por SQL, no mediante ese endpoint.

