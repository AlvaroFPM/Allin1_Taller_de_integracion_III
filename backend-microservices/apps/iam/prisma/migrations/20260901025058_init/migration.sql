-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('CLIENTE', 'PROVEEDOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CARNET_FRENTE', 'CARNET_DORSO', 'CERTIFICADO_ANTECEDENTES', 'LICENCIA_CONDUCIR');

-- CreateEnum
CREATE TYPE "EstadoVerificacion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" SERIAL NOT NULL,
    "rut" VARCHAR(25) NOT NULL,
    "nombres" VARCHAR(200) NOT NULL,
    "apellidos" VARCHAR(200) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
    "estado_activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "perfiles" (
    "id_perfil" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "bio_experiencia" TEXT,
    "habilidades" TEXT,
    "disponibilidad" VARCHAR(200),
    "ciudad" VARCHAR(100),
    "region" VARCHAR(100),
    "foto_perfil_url" VARCHAR(255),

    CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id_perfil")
);

-- CreateTable
CREATE TABLE "documentos_verificacion" (
    "id_documento" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "tipo_documento" "TipoDocumento" NOT NULL,
    "archivo_url" VARCHAR(255) NOT NULL,
    "estado_verificacion" "EstadoVerificacion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_verificacion_pkey" PRIMARY KEY ("id_documento")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_rut_key" ON "usuarios"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_id_usuario_key" ON "perfiles"("id_usuario");

-- CreateIndex
CREATE INDEX "documentos_verificacion_id_usuario_idx" ON "documentos_verificacion"("id_usuario");

-- AddForeignKey
ALTER TABLE "perfiles" ADD CONSTRAINT "perfiles_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_verificacion" ADD CONSTRAINT "documentos_verificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
