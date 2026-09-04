-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('CREADA', 'PAGADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'DISPUTA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('MERCADOPAGO', 'STRIPE', 'WEBPAY', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EstadoCustodia" AS ENUM ('RETENIDO', 'LIBERADO', 'REEMBOLSADO_TOTAL', 'REEMBOLSADO_PARCIAL');

-- CreateTable
CREATE TABLE "ordenes_servicio" (
    "id_orden" SERIAL NOT NULL,
    "id_publicacion" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "comision_plataforma" DECIMAL(12,2) NOT NULL,
    "estado_orden" "EstadoOrden" NOT NULL DEFAULT 'CREADA',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_finalizacion" TIMESTAMP(3),

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id_orden")
);

-- CreateTable
CREATE TABLE "pagos_transacciones" (
    "id_pago" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "gateway_id_mp" VARCHAR(100),
    "metodo_pago" "MetodoPago" NOT NULL DEFAULT 'MERCADOPAGO',
    "monto" DECIMAL(12,2) NOT NULL,
    "estado_pago" "EstadoPago" NOT NULL DEFAULT 'PENDING',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_gateway" JSONB,

    CONSTRAINT "pagos_transacciones_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "custodia_escrow" (
    "id_escrow" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "monto_retenido" DECIMAL(12,2) NOT NULL,
    "estado_custodia" "EstadoCustodia" NOT NULL DEFAULT 'RETENIDO',
    "fecha_retencion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_liberacion" TIMESTAMP(3),

    CONSTRAINT "custodia_escrow_pkey" PRIMARY KEY ("id_escrow")
);

-- CreateIndex
CREATE INDEX "ordenes_servicio_id_publicacion_idx" ON "ordenes_servicio"("id_publicacion");

-- CreateIndex
CREATE INDEX "ordenes_servicio_id_cliente_idx" ON "ordenes_servicio"("id_cliente");

-- CreateIndex
CREATE INDEX "ordenes_servicio_id_proveedor_idx" ON "ordenes_servicio"("id_proveedor");

-- CreateIndex
CREATE INDEX "pagos_transacciones_id_orden_idx" ON "pagos_transacciones"("id_orden");

-- CreateIndex
CREATE UNIQUE INDEX "custodia_escrow_id_orden_key" ON "custodia_escrow"("id_orden");

-- AddForeignKey
ALTER TABLE "pagos_transacciones" ADD CONSTRAINT "pagos_transacciones_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes_servicio"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custodia_escrow" ADD CONSTRAINT "custodia_escrow_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes_servicio"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;
