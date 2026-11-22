# ALL-182 — Sesión, navegación y estado al contratar

- Responsable: Francisco Barriga.
- Base inspeccionada: `develop` en `7e44a81d984a5072d007d53af2224938e984f0dd` (22-11-2026).
- Dependencia: ALL-143 consta como `Done` en Linear; su evidencia de integración se conserva separada.
- Rama de trabajo: `fix/ALL-182-front-sesion-navegacion-detalle`.
- Estado de esta comprobación: **parcial**. Faltan los recorridos visuales reales en escritorio y móvil, y la revisión cruzada. No usar este documento como prueba de cierre de esos criterios.

## Archivos y recorrido revisados

| Pieza | Entrada | Salida o efecto |
| --- | --- | --- |
| `src/app/publicaciones/[id]/page.tsx` | ID de ruta, publicación de Catálogo, sesión actual | Valida sesión, dueño, tipo, identificadores y precio; abre modal, envía orden y anuncia éxito solo tras obtener `idOrden` positivo. `key={id}` separa el estado de cada detalle. |
| `src/components/shared/purchase-confirmation-modal.tsx` | Ítem, vendedor, precio, pendiente y error | Muestra la selección; desactiva cierre, cancelación y confirmación durante el envío. |
| `src/services/orderService.ts` | `idUsuarioVendedor`, `idPublicacion`, `precio` | Envía `POST /v1/orders`; exige identificador de orden válido antes de devolver éxito. |
| `src/lib/axios.ts` y `src/app/login/page.tsx` | Error HTTP 401 | Limpia la sesión, redirige a `/login?session=expired` y ahora muestra el aviso correspondiente. También se conserva el parámetro previo `expired=true`. |

## Cambios y comprobaciones automáticas

Se corrigió la discordancia entre el parámetro de redirección de Axios (`session=expired`) y el que leía login (`expired=true`). Se añadieron pruebas para ambos parámetros y para una confirmación pendiente de la publicación A seguida de una instancia nueva de la publicación B. La prueba comprueba que el modal de B contiene su propio vendedor, ID y precio, que su solicitud los envía, y que una respuesta posterior de A no modifica el resultado de B. Es una **simulación de componentes y servicios**, no una ejecución de Next.js en navegador ni una orden persistida.

| Comprobación | Resultado en esta copia |
| --- | --- |
| `node --test tests/login-session.test.mjs tests/order-service.test.mjs tests/purchase-flow.test.mjs` | 18/18 aprobadas; servicios de Orders simulados. |
| `npx tsc --noEmit` | Exit 0. |
| `npm run build` | Exit 0; 11 rutas generadas. |
| `npm run lint` | Exit 0. |

Las pruebas existentes cubren ausencia de sesión, publicación propia, cancelar sin POST, bloqueo de segundo envío y errores HTTP 400, 401, 403, 409 y 500 sin éxito falso. El `key={id}` y el estado local separan las vistas al cambiar de publicación; una solicitud ya enviada a Orders puede terminar y persistir para A aunque se navegue a B. Este cambio de pantalla no cancela una operación confirmada en el servidor.

## Recorridos visuales pendientes en el entorno local

Usar dos publicaciones OFERTA activas con vendedores y precios diferentes, y cuentas de prueba sin publicar tokens, contraseñas ni datos personales. Inspeccionar Network → Fetch/XHR para distinguir un POST real de un estado mostrado por la interfaz. Registrar ID de publicación y de orden solo si son datos de prueba publicables.

| Vista y caso | Pasos concretos | Esperado | Observado |
| --- | --- | --- | --- |
| Escritorio: sesión válida | Abrir detalle A con comprador distinto del vendedor; abrir y cancelar; reabrir y confirmar una sola vez. | Cancelar: cero POST. Confirmar: un POST con vendedor, publicación y precio de A; no mostrar éxito antes de un `idOrden` válido. | **Pendiente de ejecutar en navegador local.** |
| Escritorio: sesión ausente y publicación propia | Sin sesión intentar contratar A; con sesión del vendedor intentar contratar su propia oferta. | Error visible; modal bloqueado; cero POST. | **Pendiente.** |
| Escritorio: navegación durante envío | Mantener pendiente la respuesta del POST de A; ir al detalle B; inspeccionar su modal; dejar que responda A y luego contratar B si corresponde. | B muestra sus datos; éxito de A no aparece en B; la petición de A puede haber persistido y debe comprobarse en Orders. | **Pendiente.** |
| Escritorio: cierre y error | Abrir/cancelar el modal antes de enviar; provocar un 400/409 o error de red tras confirmar; intentar cerrarlo mientras sigue pendiente. | Sin POST por cancelación; cierre bloqueado durante envío; error sin falso éxito; revisar Orders antes de reintentar tras error ambiguo. | **Pendiente.** |
| Escritorio: sesión expirada | Reproducir un 401 de Orders y abrir `/login?session=expired` con la rama actual. | Sesión limpia, redirección y aviso visible de expiración. | **Pendiente de comprobar en navegador local.** |
| Móvil: mismos casos críticos | Repetir A/B, cancelación, confirmación y error en vista de 390 × 844 px o dispositivo equivalente. | Modal legible y utilizable; mismo payload, aislamiento, bloqueo de envío y mensajes. | **Pendiente de ejecutar en navegador local.** |

## Limitaciones y revisión

Esta copia de trabajo no dispone del Docker ni del navegador del entorno local de Francisco. El navegador remoto no pudo acceder a `127.0.0.1:3000` de esta copia (`ERR_CONNECTION_REFUSED`); la ejecución local de Chromium también fue impedida por el aislamiento del entorno. Por eso no se acreditan recorridos de escritorio/móvil ni persistencia nueva en PostgreSQL en esta tarea. Completar la tabla con resultados observados, versión y entorno antes de solicitar cierre de ALL-182. Revisión cruzada por compañero: **pendiente**.
