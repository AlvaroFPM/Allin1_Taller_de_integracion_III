# ALL-155 — Confirmación y dashboard de órdenes reales

- Responsable: Francisco Barriga.
- Base: `develop` en `7e44a81d984a5072d007d53af2224938e984f0dd` (22-11-2026).
- Rama: `fix/ALL-155-front-confirmacion-dashboard-ordenes`.
- Entorno: Next.js local en `http://localhost:3000`; Docker Compose con IAM (`8081`), Catálogo (`8082`), Orders (`8084`) y PostgreSQL para los tres servicios. IAM, Catálogo y Orders permiten ese origen en CORS; `127.0.0.1:3000` no está permitido.
- Estado: recorrido principal comprobado con comprador ID 2 y vendedor de prueba ID 4. Se creó localmente una cuenta vendedora de prueba (ID 4) con OFERTA #54 a 33.000 para comparar compras y ventas sin acceder a cuentas ajenas. Las credenciales solo están en un archivo temporal fuera del repositorio; una primera cuenta de prueba ID 3 con OFERTA #53 quedó sin utilizar al perderse su archivo de acceso temporal.

## Cambios del frontend

En `publicaciones/[id]/page.tsx`, después de que Orders devuelve un `idOrden` positivo, el mensaje de éxito incluye un enlace a `/ordenes` para continuar a Mis Compras. La petición de creación, el bloqueo de doble envío y el dashboard se conservan. Una prueba del componente comprueba que el enlace no se muestra antes de la respuesta ni tras un error HTTP.

## Comprobaciones ejecutadas

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `node --test tests/order-service.test.mjs tests/purchase-flow.test.mjs src/store/useOrdersStore.test.cjs` | 33/33 aprobadas | Servicios simulados; no acredita persistencia. |
| `npm run lint` y `npx tsc --noEmit` | Exit 0 en ambos | Rama aislada. |
| `npm run build` | Exit 0; 11 rutas generadas | En la carpeta temporal mostró avisos EPERM al copiar archivos trazados al directorio `standalone`; el código compiló. |
| Catálogo `GET /v1/publications/51` y `/54` | Ambas OFERTA activas, precio 33000; vendedores 1 y 4 respectivamente | Datos reales de Catálogo local; la publicación 52 ya tenía una orden previa. |
| Orders `GET /v1/orders/mis-compras` sin JWT | HTTP 401 | Confirma protección del endpoint. La consulta autenticada de Ventas se registra abajo. |

## Recorrido de extremo a extremo

Se usó el comprador existente ID 2. La primera compra fue para el vendedor existente ID 1, sin acceso a su sesión para comprobar Ventas. La comparación entre ambas pestañas se hizo con un vendedor de prueba local ID 4 y la nueva publicación #54. No publicar credenciales, cabeceras `Authorization`, JWT ni respuestas de perfil.

| Paso | Esperado | Observado |
| --- | --- | --- |
| Comprador ID 2: contratar OFERTA 51 desde `/publicaciones/51` | Un `POST /v1/orders` con vendedor 1, publicación 51 y precio `"33000"`; HTTP 200 con un `idOrden` válido. Se muestra «Ver mis compras» solo después del éxito. | El comprador abrió el modal, comprobó $33.000, confirmó y pulsó «Ver mis compras». La tarjeta de Compras muestra Orden #2, publicación #51, monto 33.000 y vendedor #1. Falta conservar captura del POST/respuesta HTTP para afirmar su código y cuerpo exactos. |
| Comprador ID 2: abrir `/ordenes`, recargar y ver Mis Compras | El ID creado aparece con estado PENDIENTE. | Se observó Orden #2 en Compras con estado Pendiente junto a Orden #1 histórica; el comprador confirmó que sigue apareciendo tras recargar. |
| Comprador ID 2: contratar OFERTA de prueba #54 (vendedor ID 4) y ver Compras | Aparece un ID nuevo de orden pendiente para publicación #54. | El comprador observó Orden #3 en Compras para publicación #54, vendedor #4, 33.000 y estado Pendiente. No recargó esta lista después de la nueva orden. |
| Vendedor de prueba ID 4: cerrar sesión de comprador, ingresar como vendedor, abrir `/ordenes`, recargar y ver Mis Ventas | El mismo ID creado para publicación #54 aparece como venta; no quedan órdenes visibles de la sesión anterior. | Ventas mostró Orden #3, publicación #54, comprador #2, monto 33.000 y estado Pendiente. El vendedor recargó la página y confirmó que seguía. La consulta HTTP autenticada con esa cuenta también devolvió Orden #3, publicación #54, comprador #2, vendedor #4, estado PENDIENTE y precio 33000. |

## Estados y límites

Las pruebas de Zustand cubren carga, éxito vacío, error de consulta, solicitudes tardías y limpieza al cambiar cuenta/token. El endpoint de Orders sin JWT respondió HTTP 401; no se ensayó en navegador una caída de red para el dashboard. Sin sesión, la acción Contratar no abrió el modal. El vendedor ID 4 abrió su propia publicación #54, pulsó Contratar y observó «No puedes contratar tu propia publicación.»; no se creó una orden adicional. La tarjeta real dice «Tipo no informado» y «Moneda no informada»: la respuesta de Orders no incorpora esos datos del catálogo; no se inventan en el dashboard. Los demás escenarios de sesión/navegación de ALL-182 mantienen su evidencia y PR #357 separados y sin fusionar a esta base. Las acciones de aceptar, completar y cancelar pertenecen a ALL-156.

El ID #3 coincide entre Compras y Ventas con cuentas distintas y el backend confirma la consulta de Ventas. No se comprobó por inspección de Network el código HTTP exacto del POST ni se recargó Compras con la nueva orden #3 (sí se recargó Compras con la orden #2 y Ventas con la #3). La comprobación de PR y la revisión cruzada quedan pendientes del equipo.
