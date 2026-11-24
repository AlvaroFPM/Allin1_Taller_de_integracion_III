# ALL-188 — Retirar identidad y reputación simuladas del perfil público (Perfil público MVP)

- **Responsable:** Francisco Barriga (`@francisco879`)
- **Línea base:** `develop` en `b7bbf81` (`Merge pull request #364 from AlvaroFPM/feat/ALL-187-vendedor-identidad-publica`, incluyendo ALL-156 en `d38d76c`).
- **Rama:** `feat/ALL-188-front-perfil-publico-mvp`
- **Ticket:** https://linear.app/allin1/issue/ALL-188/sprint-final-s3-perfil-publico-mvp-retirar-identidad-y-reputacion
- **Dependencias:** ALL-187 (alineación de identidad pública del vendedor en IAM) integrada y verificada.

---

## 1. Resumen de Cambios del Frontend

Se eliminaron por completo las constantes y fallbacks de datos de ejemplo (`MOCK_SELLERS`, `DEFAULT_SELLER`, `MOCK_SELLER_REVIEWS`) en la pantalla `/perfil/[id]`, consumiendo la identidad real provista por el microservicio IAM a través de `getPublicProfile` (ALL-187) y las publicaciones reales de Catálogo (`publicationService.getPublications`).

| Archivo | Modificación realizada |
| :--- | :--- |
| `frontend-marketplace/src/app/perfil/[id]/page.tsx` | Retiro total de `MOCK_SELLERS`, `DEFAULT_SELLER` y `MOCK_SELLER_REVIEWS`. Validación numérica estricta de `id` (`/^\d+$/`). Implementación de estados explícitos (`loading`, `not-found`, `success`). Desacople con componente `PublicProfileDetail` y clave `key={rawId}` para garantizar aislamiento absoluto y desmontaje limpio entre dos vendedores consecutivos. |
| `frontend-marketplace/src/components/shared/public-profile-header.tsx` | Retiro de valores por defecto inventados (`city = 'Santiago, RM'`, `memberSince = '2024'`). Renderizado condicional de ubicación únicamente ante datos reales. Desactivación explícita del botón de contacto con etiqueta transparente `Contactar (No disponible en el MVP)`. |
| `frontend-marketplace/src/components/shared/public-profile-reputation.tsx` | Retiro de métricas ficticias por defecto (`score = 4.9`, `totalReviews = 28`, `completionRate = 98`, `responseTime = '< 15 min'`). Incorporación de prop `available` (por defecto `false`), informando honestamente que las métricas y calificaciones no forman parte del alcance del MVP. |
| `frontend-marketplace/src/components/shared/public-profile-reviews.tsx` | Retiro de `MOCK_SELLER_REVIEWS` como valor por defecto (`reviews = []`). Renderizado de estado vacío con 0 opiniones y mensaje aclaratorio de fase posterior. |
| `frontend-marketplace/tests/public-profile.test.mjs` | Nueva suite de 4 pruebas automatizadas con aislamiento de hooks para verificar: 1) Rechazo de 404 / fallo de API sin mostrar mocks, 2) Rechazo de ID no numérico, 3) Consumo de perfil auténtico sin reputación ni reseñas ficticias, y 4) Aislamiento total entre dos perfiles consecutivos. |

No se modificaron archivos del microservicio backend (`backend-go`), esquemas de base de datos ni contratos de servicios.

---

## 2. Comprobaciones Automatizadas y Build

Comandos ejecutados localmente desde `frontend-marketplace/`:

| Comando | Resultado | Alcance |
| :--- | :---: | :--- |
| `node --test tests/public-profile.test.mjs src/services/authService.test.mjs tests/purchase-flow.test.mjs src/services/ordersMutationService.test.cjs src/store/useOrderActionsStore.test.cjs src/store/useOrdersStore.test.cjs tests/order-service.test.mjs` | **83/83 PASS (0 fallos)** | Suite completa de perfil público, autenticación, mutaciones de órdenes, stores de estado y flujo de compra. |
| `npm run lint` | **Exit 0** | Sin errores ni advertencias de ESLint / Prettier. |
| `npx tsc --noEmit` | **Exit 0** | Verificación estricta de tipos de TypeScript aprobada. |
| `npm run build` | **Exit 0** | Compilación de producción con Turbopack exitosa (11 rutas optimizadas generadas). |

---

## 3. Estado de los Criterios de Aceptación

- [x] **Dos vendedores consecutivos muestran sus propios datos y publicaciones:**  
  La separación mediante `key={rawId}` en `PublicProfileDetail` asegura que la navegación entre `/perfil/1` y `/perfil/2` remonte el componente limpiando todo estado previo, cancelando peticiones en curso con `AbortController` y renderizando exclusivamente las publicaciones asociadas a cada vendedor. Acreditado por la prueba unitaria `dos vendedores consecutivos no mezclan datos ni publicaciones`.
- [x] **Un ID inexistente o fallo de API no presenta un perfil de ejemplo como válido:**  
  Ante un ID no numérico (ej. `invalido-abc`) o ante una respuesta `null` de `getPublicProfile` (usuario inexistente en IAM o fallo de red), la interfaz muestra inmediatamente la pantalla de estado `Vendedor no encontrado`, sin recurrir a ningún vendedor ficticio de reserva. Acreditado por las pruebas `ID inexistente (404)...` y `ID no numérico...`.
- [x] **El recorrido del MVP no presenta reputación ni contacto simulado como funcionalidad entregada:**  
  Se deshabilitó el botón de contacto con la leyenda informativa `Contactar (No disponible en el MVP)`. Las reseñas inician en 0 opiniones con estado vacío y la tarjeta de reputación comunica explícitamente que las métricas y calificaciones no están disponibles en esta versión, eliminando cualquier simulación de funcionalidad no entregada.

---

## 4. Límites y Alcance

- La mensajería y chat entre usuarios corresponde a la integración de Chat (ALL-190). En el perfil público el control permanece deshabilitado informando su no disponibilidad en el MVP.
- Las reseñas y calificaciones no cuentan con backend implementado en el alcance del MVP, por lo que su visualización refleja un conteo de 0 sin testimonios simulados.
- No se realizaron modificaciones en la infraestructura de Docker ni en los manifiestos de Kubernetes.
