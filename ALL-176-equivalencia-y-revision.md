# ALL-176 — Comprobación de equivalencia y revisión de cambios (Frontend)

- **Responsable:** Francisco Barriga
- **Presupuesto:** 2 puntos (2 horas)
- **Rama de trabajo:** `fbarriga2024/all-176-sprint-final-s1-refactor-frontend`
- **Base de comparación:**
  - **Antes:** `develop` en `edd6010` (línea base previa al refactor de ALL-132).
  - **Después:** Commit `7018cf6` (refactor acotado), integrado en `develop` vía commit `1ecb42e` (PR #326).
- **Refactor evaluado:** ALL-132 — PR #326 (https://github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/pull/326)
- **Fecha de ejecución:** 16-11-2026
- **Revisión cruzada:** Pendiente de registro formal por compañero en GitHub (el PR #326 fue fusionado directamente por el Scrum Master sin comentarios de revisión formal).

---

## 1. Comprobaciones existentes y resultados comparativos

Comandos ejecutados en `frontend-marketplace/`:
- `npm run lint` (ESLint)
- `npx tsc --noEmit` (TypeScript Compiler)
- `npm run build` (Turbopack / Next.js)

| Comprobación | Antes (`edd6010`) | Después (`7018cf6` / PR #326) | Estado |
| :--- | :---: | :---: | :---: |
| `npm run lint` | Exit 0 (0 errores, 0 warnings) | Exit 0 (0 errores, 0 warnings) | Idéntico |
| `npx tsc --noEmit` | Exit 0 (sin errores de tipos) | Exit 0 (sin errores de tipos) | Idéntico |
| `npm run build` | Exit 0 (11 rutas generadas) | Exit 0 (11 rutas generadas) | Idéntico |

*Nota sobre entornos:* En la máquina local Windows amd64 el build compila satisfactoriamente en Exit 0. En entornos sandboxed con cuotas restringidas de procesos hijos Turbopack puede abortar durante el procesamiento de CSS.

---

## 2. Comparación antes/después del flujo modificado (Publicar)

### A. Caso Nominal (Publicación exitosa)
- **Entrada:** Usuario autenticado completa título (>=5 caracteres), descripción (>=50 caracteres), precio (>0) y categoría válida.
- **Antes:** `fetchCategories` llamaba a `getCategories()`, actualizaba `categories` y el `finally` llamaba a `setIsLoadingCategories(false)`. Al enviar, se ejecuta `createPublication`, emite `alert()` de éxito y redirige a `'/'`.
- **Después:** `fetchCategories` actualiza `categories` sin llamar al setter eliminado. El formulario valida idénticamente, ejecuta el mismo POST hacia `/v1/publications`, emite el mismo `alert()` y navega a `'/'`.
- **Equivalencia:** Idéntico (el estado eliminado nunca se leía en el render).

### B. Caso de Error (Categorías caídas o vacías)
- **Entrada:** El servicio backend de categorías falla o no está disponible.
- **Mecanismo real:** `publicationService.getCategories()` captura internamente la excepción y retorna `[]`. En `page.tsx`, `data` es `[]`, por lo que el `catch` de `page.tsx` no se activa; el selector queda sin opciones (`categories = []`).
- **Comportamiento al enviar:** `handleSubmit` comprueba `!formState.categoriaId` y detiene el envío mostrando el mensaje en banner: *«Por favor completa todos los campos obligatorios»*.
- **Equivalencia:** Idéntico antes y después (el `finally` retirado solo asignaba `false` a una variable huérfana).

---

## 3. Verificación de flujos existentes no modificados

Para dar cumplimiento a la actividad de revisión de componentes, servicios y stores existentes, se verificó la invariabilidad de sus contratos, entradas y efectos:

| Módulo / Flujo | Archivos auditados | Entradas y dependencias | Salidas y efectos persistentes | Estado tras refactor |
| :--- | :--- | :--- | :--- | :--- |
| **Login** | `login/page.tsx`, `login-card.tsx`, `login-form.tsx` | `email`, `password`, submit | POST `/v1/auth/login`, cookie `auth_token`, store Zustand (`setAuth`), redirección condicional. | Inalterado (0 diffs en PR #326). |
| **Registro** | `registro/page.tsx`, `register-card.tsx`, `register-form.tsx` | Datos usuario (6 campos JSON) | POST `/v1/auth/register`, cookie `auth_token`, store Zustand, timer redirección. | Inalterado (0 diffs en PR #326). |
| **Detalle publicación** | `publicaciones/[id]/page.tsx`, `publicationService.ts` | Parámetro `id` dinámico | Carga pública con `AbortController`, estados discriminated union, modal de confirmación y orden. | Inalterado (0 diffs en PR #326). |
| **Perfil usuario** | `perfil/[id]/page.tsx`, `authService.ts` | Parámetro `id`, `getPublicProfile` | Consulta `/v1/auth/profile/${userId}`, mapeo y renderizado de perfil. | Inalterado (0 diffs en PR #326). |

---

## 4. Revisión del Diff de ALL-132 (PR #326)

- **Archivos modificados:** 1 (`frontend-marketplace/src/app/publicar/page.tsx`).
- **Métricas:** +0 inserciones, -3 eliminaciones.
- **Detalle de las líneas eliminadas:**
  - `const [, setIsLoadingCategories] = React.useState(true);` (declaración huérfana).
  - `finally { setIsLoadingCategories(false); }` (bloque que solo contenía la mutación huérfana).
- **Consumidores:** Se comprobó que `isLoadingCategories` no tenía ningún consumidor en el DOM ni en la lógica reactiva.
- **Cumplimiento de límites:** Cero funciones nuevas, cero endpoints, contratos `.proto`/`.ts` intactos, sin tocar `output/mds/`.

---

## 5. Defectos funcionales diferidos (Para semanas posteriores)

Se ratifican los defectos funcionales detectados para su resolución en los sprints correspondientes:
1. **Desfase en sesión expirada:** `login/page.tsx:11` (`expired=true`) vs `lib/axios.ts:42` (`session=expired`).
2. **Retorno `null` no validado en publicación:** `publicar/page.tsx:98-109` emite `alert()` de éxito aun si `createPublication` retorna `null`.
3. **Mocks en perfil:** `perfil/[id]/page.tsx` contiene perfiles y reseñas hardcodeadas de respaldo.
4. **Modernización de UI:** Sustitución de `window.alert()` por banners reactivos.

---

## 6. Alcance alcanzado y limitaciones

- **Alcanzado:** Comprobación estática completa (`lint`, `tsc`, `build`), comparación nominal y de error documentadas con exactitud de flujo, verificación de flujos inalterados y revisión del diff de PR #326.
- **Limitaciones:** La revisión cruzada entre compañeros quedó pendiente de firma formal en GitHub. No se ejecutaron pruebas E2E automatizadas de navegador ni despliegue en clúster k8s local.
