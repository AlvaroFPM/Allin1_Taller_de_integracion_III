-- CreateEnum
CREATE TYPE "EstadoDisputa" AS ENUM ('ABIERTA', 'EN_MEDIACION', 'RESUELTA_LIBERACION', 'RESUELTA_REEMBOLSO_TOTAL', 'RESUELTA_REEMBOLSO_PARCIAL', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoResolucion" AS ENUM ('LIBERACION_FONDOS_PROVEEDOR', 'REEMBOLSO_TOTAL_CLIENTE', 'REEMBOLSO_PARCIAL', 'DESESTIMADA');

-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'EN_REVISION', 'SANCIONADO', 'DESESTIMADO');

-- CreateTable
CREATE TABLE "disputas" (
    "id_disputa" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_reclamante" INTEGER NOT NULL,
    "id_demandado" INTEGER NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "estado_disputa" "EstadoDisputa" NOT NULL DEFAULT 'ABIERTA',
    "tipo_resolucion" "TipoResolucion",
    "id_reembolso" INTEGER,
    "resolucion" TEXT,
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputas_pkey" PRIMARY KEY ("id_disputa")
);

-- CreateTable
CREATE TABLE "evidencias_disputa" (
    "id_evidencia" SERIAL NOT NULL,
    "id_disputa" INTEGER NOT NULL,
    "archivo_url" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_disputa_pkey" PRIMARY KEY ("id_evidencia")
);

-- CreateTable
CREATE TABLE "reportes_usuarios" (
    "id_reporte" SERIAL NOT NULL,
    "id_denunciante" INTEGER NOT NULL,
    "id_reportado" INTEGER NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_usuarios_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputas_id_orden_key" ON "disputas"("id_orden");

-- CreateIndex
CREATE INDEX "disputas_id_orden_idx" ON "disputas"("id_orden");

-- CreateIndex
CREATE INDEX "disputas_id_reclamante_idx" ON "disputas"("id_reclamante");

-- CreateIndex
CREATE INDEX "disputas_id_demandado_idx" ON "disputas"("id_demandado");

-- CreateIndex
CREATE INDEX "evidencias_disputa_id_disputa_idx" ON "evidencias_disputa"("id_disputa");

-- CreateIndex
CREATE INDEX "reportes_usuarios_id_denunciante_idx" ON "reportes_usuarios"("id_denunciante");

-- CreateIndex
CREATE INDEX "reportes_usuarios_id_reportado_idx" ON "reportes_usuarios"("id_reportado");

-- AddForeignKey
ALTER TABLE "evidencias_disputa" ADD CONSTRAINT "evidencias_disputa_id_disputa_fkey" FOREIGN KEY ("id_disputa") REFERENCES "disputas"("id_disputa") ON DELETE CASCADE ON UPDATE CASCADE;
