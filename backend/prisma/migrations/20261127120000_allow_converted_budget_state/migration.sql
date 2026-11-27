-- La conversión a orden deja el presupuesto en estado CONVERTIDO.
-- La restricción antigua no contemplaba ese estado y provocaba un error 500.
ALTER TABLE "public"."presupuestos"
  DROP CONSTRAINT IF EXISTS "presupuestos_estado_check";

ALTER TABLE "public"."presupuestos"
  ADD CONSTRAINT "presupuestos_estado_check"
  CHECK ("estado" IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'CONVERTIDO'));
