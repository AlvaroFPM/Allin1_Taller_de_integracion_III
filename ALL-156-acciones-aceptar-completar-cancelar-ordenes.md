# ALL-156 — Conectar acciones de aceptar, completar y cancelar órdenes con resultado real

- **Responsable:** Francisco Barriga (`@francisco879`).
- **Línea base:** `develop` en `38f6a0cdfc99b756be58f88be5ef591be67c7476` (23-11-2026).
- **Rama:** `feat/ALL-156-front-acciones-ordenes-mvp`.
- **Ticket:** https://linear.app/allin1/issue/ALL-156/sprint-final-s3-frontend-mvp-conectar-aceptar-completar-y-cancelar-con
- **Dependencias:** ALL-150 (backend Orders con ciclo de vida completo habilitado) y ALL-155 (navegación y visualización de órdenes reales en el dashboard).

---

## 1. Resumen de Cambios del Frontend

Se habilitó el ciclo de vida completo de transiciones de órdenes en la interfaz de usuario, conectando las acciones de aceptar, completar y cancelar con el endpoint `PATCH /v1/orders/{id}` implementado en el microservicio de Orders (ALL-150).

| Archivo | Modificación |
| :--- | :--- |
| `frontend-marketplace/src/services/ordersMutationService.ts` | Se añadió `'CANCELADA'` a la unión de tipos `OrderActionState` y se actualizó la validación defensiva en ejecución para admitir peticiones de cancelación hacia el backend. |
| `frontend-marketplace/src/store/useOrderActionsStore.ts` | Se incorporaron las reglas de autorización para `'CANCELADA'`: permitida tanto al comprador como al vendedor cuando la orden se encuentra en estado `PENDIENTE` o `ACEPTADA`. Se preservaron intactos los bloqueos de doble envío, el refresco de listas independientes y la distinción de errores. |
| `frontend-marketplace/src/components/shared/order-card.tsx` | Se añadió la prop opcional `onCancel` y el renderizado del botón «Cancelar» con variante destructiva, deshabilitado automáticamente mientras una acción esté en curso (`actionPending`). |
| `frontend-marketplace/src/components/shared/orders-dashboard-panel.tsx` | Se conectó la prop `onCancel` para invocar `changeStatus(id, 'CANCELADA')` cuando el usuario autenticado sea participante de la orden y el estado admita cancelación. |
| `frontend-marketplace/src/app/publicaciones/[id]/page.tsx` | Se ubicó el atributo `role="status"` en el párrafo que anuncia la creación de la orden para mantener compatibilidad con las aserciones de aislamiento de rutas. |
| `frontend-marketplace/src/services/ordersMutationService.test.cjs` | Se actualizó la suite de pruebas del servicio de mutaciones para validar el envío correcto de `'CANCELADA'` y el rechazo de estados no autorizados para mutación directa. |
| `frontend-marketplace/src/store/useOrderActionsStore.test.cjs` | Se agregaron 4 casos de éxito para cancelaciones (comprador y vendedor en estados pendiente y aceptada) y 5 nuevos casos de rechazo sin llamada HTTP (terceros y estados finales inmutables). |

No se modificó ningún archivo de backend (`backend-go`), esquemas de base de datos ni contratos de servicios.

---

## 2. Matriz de Transiciones y Permisos Coordinada con Backend (ALL-150)

La lógica de frontend refleja estrictamente la máquina de estados y las reglas de autorización impuestas por el backend en `backend-go/internal/service/order_service.go`:

| Estado Actual | Transición Solicitada | Roles Autorizados | Backend HTTP | Comportamiento UI / Store |
| :--- | :---: | :---: | :---: | :--- |
| **`PENDIENTE`** | `ACEPTADA` | Solo Vendedor | `200 OK` (Comprador/Tercero: `403`) | Botón «Aceptar» disponible solo para el vendedor. |
| **`PENDIENTE`** | `CANCELADA` | Comprador o Vendedor | `200 OK` (Tercero: `403`) | Botón «Cancelar» disponible para ambos participantes. |
| **`ACEPTADA`** | `COMPLETADA` | Comprador o Vendedor | `200 OK` (Tercero: `403`) | Botón «Completar» disponible para ambos participantes. |
| **`ACEPTADA`** | `CANCELADA` | Comprador o Vendedor | `200 OK` (Tercero: `403`) | Botón «Cancelar» disponible para ambos participantes. |
| **`COMPLETADA`** | *Cualquiera* | Ninguno (Inmutable) | `400 Bad Request` | No se renderizan botones de transición de estado. |
| **`CANCELADA`** | *Cualquiera* | Ninguno (Inmutable) | `400 Bad Request` | No se renderizan botones de transición de estado. |

---

## 3. Comprobaciones Automatizadas

Todas las suites de pruebas y chequeos de calidad de código fueron ejecutados localmente en la rama:

| Comando | Resultado | Alcance |
| :--- | :---: | :--- |
| `node --test src/services/ordersMutationService.test.cjs src/store/useOrderActionsStore.test.cjs src/store/useOrdersStore.test.cjs tests/order-service.test.mjs tests/purchase-flow.test.mjs` | **61/61 PASS (0 fallos)** | Suite completa de contratos, stores, mutaciones y flujo de contratación. |
| `npm run lint` | **Exit 0** | Sin advertencias ni errores de ESLint / Prettier. |
| `npx tsc --noEmit` | **Exit 0** | Chequeo estricto de tipos de TypeScript aprobado. |
| `npm run build` | **Exit 0** | Compilación de producción con Turbopack exitosa (11 rutas generadas). |

---

## 4. Estado de los Criterios de Aceptación

- [x] **Las acciones permitidas persisten el estado y se reflejan en compras/ventas:**  
  Las mutaciones `ACEPTADA`, `COMPLETADA` y `CANCELADA` envían la petición `PATCH /v1/orders/{idOrden}` con el token JWT de la sesión activa y disparan el refresco sincronizado de `loadPurchases` y `loadSales`.
- [x] **Un tercero o transición inválida no se representa como operación aplicada:**  
  La validación previa en `useOrderActionsStore` rechaza la acción sin emitir la petición HTTP si el usuario no es participante o si la orden no se encuentra en el estado requerido. Si la petición llegara al backend, este responde con `403 Forbidden` o `400 Bad Request`, lo cual es capturado en el store registrando el error sin alterar las listas locales.
- [x] **La UI informa el resultado real y permite consultar el estado después de error de refresco o red:**  
  El store distingue entre un error en la mutación PATCH y un fallo posterior en el refresco GET: si la mutación fue confirmada pero el refresco falla, se notifica explícitamente: *«El cambio fue confirmado, pero no se pudieron actualizar todas las listas. Recarga las ordenes.»*.

---

## 5. Límites y Coordinación

- Pagos y custodia escrow corresponden a fases posteriores y no forman parte del MVP.
- Las tarjetas del dashboard muestran «Tipo no informado» y «Moneda no informada» dado que la API de órdenes no retorna dichos campos del catálogo (conforme a lo documentado en ALL-144).
- No se levantaron contenedores adicionales ni se modificaron manifiestos de Kubernetes en esta tarea.
