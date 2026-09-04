-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "PlataformaDispositivo" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('EMAIL', 'PUSH', 'SMS');

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL DEFAULT 'IN_APP',
    "titulo" VARCHAR(150) NOT NULL,
    "contenido" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "estado_envio" "EstadoEnvio" NOT NULL DEFAULT 'ENVIADO',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "dispositivos_push" (
    "id_dispositivo" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_fcm" TEXT NOT NULL,
    "plataforma" "PlataformaDispositivo" NOT NULL DEFAULT 'WEB',
    "ultimo_acceso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivos_push_pkey" PRIMARY KEY ("id_dispositivo")
);

-- CreateTable
CREATE TABLE "preferencias_notificacion" (
    "id_preferencia" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferencias_notificacion_pkey" PRIMARY KEY ("id_preferencia")
);

-- CreateIndex
CREATE INDEX "notificaciones_id_usuario_idx" ON "notificaciones"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_push_token_fcm_key" ON "dispositivos_push"("token_fcm");

-- CreateIndex
CREATE INDEX "dispositivos_push_id_usuario_idx" ON "dispositivos_push"("id_usuario");

-- CreateIndex
CREATE INDEX "preferencias_notificacion_id_usuario_idx" ON "preferencias_notificacion"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_notificacion_id_usuario_canal_key" ON "preferencias_notificacion"("id_usuario", "canal");
