-- Los vehículos antiguos también conservan el RUT del cliente.
-- Al eliminar el cliente, esa referencia debe quedar nula para no bloquear
-- la eliminación por una restricción heredada que no está en el esquema Prisma.
ALTER TABLE "public"."vehiculos"
  DROP CONSTRAINT IF EXISTS "vehiculos_cliente_rut_fkey";

ALTER TABLE "public"."vehiculos"
  ADD CONSTRAINT "vehiculos_cliente_rut_fkey"
  FOREIGN KEY ("cliente_rut")
  REFERENCES "public"."clientes"("rut")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "public"."vehiculos"
  DROP CONSTRAINT IF EXISTS "vehiculos_cliente_id_fkey";

ALTER TABLE "public"."vehiculos"
  ADD CONSTRAINT "vehiculos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id")
  REFERENCES "public"."clientes"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
