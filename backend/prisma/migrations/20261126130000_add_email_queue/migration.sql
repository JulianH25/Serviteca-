CREATE TABLE "public"."correos_pendientes" (
  "id" SERIAL NOT NULL,
  "destino" VARCHAR(120) NOT NULL,
  "asunto" VARCHAR(200) NOT NULL,
  "texto" TEXT NOT NULL,
  "html" TEXT,
  "estado" VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "proximo_intento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_error" TEXT,
  "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviado_en" TIMESTAMPTZ(6),
  CONSTRAINT "correos_pendientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_correos_pendientes" ON "public"."correos_pendientes"("estado", "proximo_intento");
