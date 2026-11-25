CREATE TABLE "public"."verificaciones_portal" (
    "id" TEXT NOT NULL,
    "cliente_rut" VARCHAR(12) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "codigo_hash" VARCHAR(128) NOT NULL,
    "salt" VARCHAR(64) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificaciones_portal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_verificacion_portal_expira" ON "public"."verificaciones_portal"("expira_en");
