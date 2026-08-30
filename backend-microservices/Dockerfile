# ==========================================
# Etapa 1: Builder
# ==========================================
# Usamos node:22-alpine como imagen base (compatible con @types/node ^24 y NestJS 11).
FROM node:22-alpine AS builder

# Argumento para especificar qué microservicio compilar (ej: iam).
ARG APP_NAME

# Establecemos el directorio de trabajo dentro del contenedor.
WORKDIR /usr/src/app

# Copiamos los archivos de manifiesto de dependencias primero para aprovechar la caché de capas de Docker.
COPY package.json package-lock.json ./

# Instalamos todas las dependencias (incluyendo devDependencies) para tener @nestjs/cli y poder compilar.
RUN npm ci

# Copiamos el resto del código fuente del monorepo (incluyendo apps/ y libs/).
COPY . .

# Compilamos el microservicio especificado en el build argument usando el CLI de Nest.
# Al tener "webpack": true, el output será empaquetado en dist/apps/$APP_NAME/main.js
RUN npx nest build ${APP_NAME}

# ==========================================
# Etapa 2: Runner
# ==========================================
# Usamos una nueva imagen base limpia para el entorno de producción.
FROM node:22-alpine AS runner

# Definimos el argumento nuevamente en esta etapa para poder pasarlo a una variable de entorno.
ARG APP_NAME
# Guardamos el APP_NAME como variable de entorno para que esté disponible en tiempo de ejecución (CMD).
ENV APP_NAME=${APP_NAME}

# Establecemos la variable de entorno de Node en producción.
ENV NODE_ENV=production

# Establecemos el directorio de trabajo en la imagen final.
WORKDIR /usr/src/app

# Copiamos los archivos de manifiesto nuevamente para instalar las dependencias finales.
COPY package.json package-lock.json ./

# Ejecutamos npm ci --omit=dev para instalar ÚNICAMENTE dependencias de producción.
# Esto asegura que devDependencies (como prisma o @nestjs/cli) no estén presentes,
# pero dependencies (como @prisma/client) sí se instalen correctamente.
RUN npm ci --omit=dev

# Copiamos SOLAMENTE el directorio dist/ generado en la etapa 'builder'.
COPY --from=builder /usr/src/app/dist ./dist

# Exponemos el puerto 3000 (el cual revisamos en apps/iam/src/main.ts).
EXPOSE 3000

# El script start:prod de package.json no nos sirve porque no es dinámico.
# Usamos sh -c para interpolar la variable de entorno APP_NAME en el path de ejecución de node,
# apuntando al bundle generado por webpack.
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]
