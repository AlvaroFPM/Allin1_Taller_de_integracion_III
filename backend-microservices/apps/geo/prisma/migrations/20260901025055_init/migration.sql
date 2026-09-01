-- CreateTable
CREATE TABLE "ubicaciones_registradas" (
    "id_ubicacion" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "etiqueta" VARCHAR(50),
    "direccion_texto" VARCHAR(255) NOT NULL,
    "latitud" DECIMAL(10,8) NOT NULL,
    "longitud" DECIMAL(11,8) NOT NULL,

    CONSTRAINT "ubicaciones_registradas_pkey" PRIMARY KEY ("id_ubicacion")
);

-- CreateTable
CREATE TABLE "zonas_cobertura" (
    "id_zona" SERIAL NOT NULL,
    "id_usuario_proveedor" INTEGER NOT NULL,
    "nombre_zona" VARCHAR(100) NOT NULL,
    "radio_km" DECIMAL(6,2) NOT NULL,
    "disponible_ahora" BOOLEAN NOT NULL DEFAULT true,
    "poligono_json" JSONB,

    CONSTRAINT "zonas_cobertura_pkey" PRIMARY KEY ("id_zona")
);

-- CreateTable
CREATE TABLE "historial_tracking_orden" (
    "id_tracking" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "latitud" DECIMAL(10,8) NOT NULL,
    "longitud" DECIMAL(11,8) NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_tracking_orden_pkey" PRIMARY KEY ("id_tracking")
);

-- CreateIndex
CREATE INDEX "ubicaciones_registradas_id_usuario_idx" ON "ubicaciones_registradas"("id_usuario");

-- CreateIndex
CREATE INDEX "zonas_cobertura_id_usuario_proveedor_idx" ON "zonas_cobertura"("id_usuario_proveedor");

-- CreateIndex
CREATE INDEX "historial_tracking_orden_id_orden_idx" ON "historial_tracking_orden"("id_orden");
