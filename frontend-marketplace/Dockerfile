# ==========================================
# Etapa 1: Builder
# ==========================================
# Utilizamos node:20-alpine como base según la compatibilidad con @types/node ^20.
FROM node:20-alpine AS builder

# Establecemos el directorio de trabajo dentro del contenedor.
WORKDIR /app

# Copiamos solo los archivos de dependencias de frontend-marketplace.
# Esto aprovecha la caché de capas de Docker para evitar reinstalar dependencias si solo cambia el código fuente.
COPY package.json package-lock.json ./

# Instalamos TODAS las dependencias (necesarias para poder ejecutar npm run build).
RUN npm ci

# Copiamos el resto del código fuente del proyecto Next.js (src, public, next.config.ts, etc).
COPY . .

# Compilamos la aplicación.
# Dado que "output: 'standalone'" está configurado en next.config.ts, esto creará una carpeta .next/standalone
# con un servidor Node autocontenido y un node_modules muy reducido.
RUN npm run build

# ==========================================
# Etapa 2: Runner
# ==========================================
# Usamos una imagen base totalmente limpia para el contenedor final de producción.
FROM node:20-alpine AS runner

# Establecemos el entorno en producción para optimizaciones de Node.js.
ENV NODE_ENV=production

# Establecemos el directorio de trabajo final.
WORKDIR /app

# Copiamos la carpeta public tal como la requiere Next.js para servir estáticos genéricos (ej: favicon).
COPY --from=builder /app/public ./public

# Copiamos el servidor standalone y su node_modules mínimo.
# NOTA: Al verificar el output de Next.js standalone en este proyecto, notamos que empaquetó todo
# bajo la ruta ".next/standalone/frontend-marketplace". Por tanto, extraemos directamente su contenido.
COPY --from=builder /app/.next/standalone ./

# Copiamos la carpeta .next/static por separado.
# El build standalone por defecto NO incluye los estáticos compilados de Next.js (asume que los
# podrías servir desde un CDN externo). Necesitamos copiarlos a .next/static para servirlos localmente.
COPY --from=builder /app/.next/static ./.next/static

# Configuramos variables de entorno para el puerto y el host.
# HOSTNAME="0.0.0.0" es crucial en Docker para que Next.js escuche tráfico externo, no solo de localhost.
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Exponemos el puerto 3000 para acceso desde fuera del contenedor.
EXPOSE 3000

# Con output standalone, en lugar de usar "next start", ejecutamos directamente el "server.js" generado.
# Esto arranca mucho más rápido, usa menos memoria y no requiere Next.js en las dependencias.
CMD ["node", "server.js"]
