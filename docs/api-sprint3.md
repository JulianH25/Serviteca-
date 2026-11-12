# API del Sprint 3: presupuestos, pagos y comprobantes

Endpoints que usan las pantallas nuevas del frontend. Todos van bajo `/api`, usan
`verificarToken` (solo personal) y responden JSON. Los errores siguen el formato de
siempre: `{ "error": "mensaje para el usuario" }` con status 4xx. El frontend muestra
ese mensaje tal cual.

Las tablas ya existen en `schema.prisma` (`Presupuesto`, `PresupuestoDetalle`, `Pago`,
`Comprobante`), así que **no hace falta migración**.

## Regla de montos: los precios incluyen IVA

Los precios del catálogo (`precioBase`, `precioVenta`) se tratan como precios finales
con IVA incluido, igual que en las órdenes. El presupuesto solo **desglosa** ese total:

```js
const total = detalle.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
const subtotal = Math.round(total / 1.19)   // neto
const iva = total - subtotal                // así neto + IVA = total exacto
```

Así, el total de un presupuesto es igual al de la orden que se crea desde él.
**El backend debe calcular estos montos**, no confiar en lo que mande el frontend.
La misma función está en `frontend/src/utils/presupuestos.js` (`desglosarIva`), con tests.

---

## Presupuestos

Estados guardados: `PENDIENTE` (al crear), `APROBADO`, `RECHAZADO`.
"Vencido" **no se guarda**: el frontend lo calcula con `fecha + validezDias`.

### `GET /presupuestos`
Query opcionales: `estado` (uno de los 3 de arriba) y `q` (patente, nombre o RUT del
cliente, o número de presupuesto). Ordenados por `id` descendente.

```json
[{
  "id": 7, "fecha": "2026-11-11T00:00:00.000Z", "validezDias": 15, "estado": "PENDIENTE",
  "subtotal": 36134, "iva": 6866, "total": 43000, "ordenId": null,
  "vehiculo": { "id": 3, "patente": "BBCL28", "marca": "Chevrolet", "modelo": "Camaro",
                "cliente": { "id": 5, "nombre": "Neymar Junior", "rut": "21.745.524-3" } }
}]
```

### `GET /presupuestos/:id`
Lo mismo, más `detalle` y `usuario`:

```json
{
  "id": 7, "...": "...",
  "usuario": { "nombre": "Recepción", "email": "..." },
  "detalle": [
    { "id": 1, "servicioId": 1, "productoId": null, "descripcion": "Cambio de aceite",
      "cantidad": 1, "precioUnitario": 25000 },
    { "id": 2, "servicioId": null, "productoId": 4, "descripcion": "Aceite 10W40 1L",
      "cantidad": 4, "precioUnitario": 4500 }
  ]
}
```
`404` con `"Presupuesto no encontrado"`.

### `POST /presupuestos`
```json
{
  "vehiculoId": 3,
  "validezDias": 15,
  "detalle": [
    { "servicioId": 1, "productoId": null, "descripcion": "Cambio de aceite", "cantidad": 1, "precioUnitario": 25000 },
    { "servicioId": null, "productoId": 4, "descripcion": "Aceite 10W40 1L", "cantidad": 4, "precioUnitario": 4500 }
  ]
}
```
- Cada línea trae **o** `servicioId` **o** `productoId` (nunca los dos, nunca ninguno).
- `usuarioId = req.usuario.id`, `estado = "PENDIENTE"`, `fecha = hoy`.
- Calcular `subtotal`, `iva` y `total` con la regla de arriba.
- **No descuenta stock** (es solo una cotización).

Responde `201` con al menos `{ "id": 7 }`. El frontend redirige al detalle.

### `PATCH /presupuestos/:id/estado`
```json
{ "estado": "APROBADO" }
```
Solo se puede cambiar si está `PENDIENTE` y no está vencido. Si no, `400` con un mensaje
claro (`"El presupuesto ya fue aprobado"`, `"El presupuesto está vencido"`).

### `POST /presupuestos/:id/orden`
Crea una orden de trabajo desde un presupuesto **aprobado**, en una sola transacción:
1. Verificar que esté `APROBADO` y que `ordenId` sea `null` (si no, `400`).
2. Crear la orden igual que `POST /ordenes`: líneas con `servicioId` pasan a
   `orden_servicios` y las con `productoId` a `orden_productos` (descontando stock y
   registrando el `MovimientoInventario` `SALIDA`), con estado `RECEPCIONADO` y su
   registro en `orden_estados_historial`.
3. Guardar `presupuesto.ordenId = orden.id`.

Si falta stock, `400` con `"No hay stock suficiente de <producto> (quedan N)"` y no se
guarda nada. Responde `201` con `{ "id": <id de la orden> }`.

> Lo más simple es reutilizar la función que ya crea órdenes en `routes/ordenes.js`.

---

## Pagos

Métodos válidos: `EFECTIVO`, `DEBITO`, `CREDITO`, `TRANSFERENCIA`.
Una orden puede tener varios pagos (abonos). Cada pago genera **un** comprobante.

### `GET /ordenes/:id/pagos`
```json
{
  "total": 43000,
  "pagado": 20000,
  "saldo": 23000,
  "pagos": [{
    "id": 1, "monto": 20000, "metodo": "EFECTIVO", "fecha": "...",
    "usuario": { "nombre": "Recepción", "email": "..." },
    "comprobante": { "id": 1, "numero": "C-000001" }
  }]
}
```
`total` es el mismo total que ya devuelve `GET /ordenes/:id`.

### `POST /ordenes/:id/pagos`
```json
{ "monto": 20000, "metodo": "EFECTIVO" }
```
En una sola transacción:
1. Validar: `monto` entero mayor a 0, `metodo` válido, orden **no** `CANCELADO`, y
   `monto <= saldo` (total − pagos anteriores). Si no, `400`.
2. Crear el `Pago` con `usuarioId = req.usuario.id`.
3. Crear el `Comprobante` con un `numero` correlativo, por ejemplo
   `"C-" + String(pago.id).padStart(6, "0")` → `C-000001`.

Responde `201` con el pago **incluyendo su comprobante**:
```json
{ "id": 2, "monto": 23000, "metodo": "DEBITO", "comprobante": { "id": 2, "numero": "C-000002" } }
```

### `GET /pagos`
Query: `desde` y `hasta` en formato `YYYY-MM-DD`, ambos inclusive, en **hora de Chile**
(`hasta` incluye todo ese día). Ordenados por fecha descendente.

```json
[{
  "id": 2, "monto": 23000, "metodo": "DEBITO", "fecha": "...", "ordenId": 4,
  "comprobante": { "id": 2, "numero": "C-000002" },
  "orden": { "vehiculo": { "patente": "BBCL28", "cliente": { "nombre": "Neymar Junior" } } }
}]
```

---

## Comprobantes

### `GET /comprobantes/:id`
Todo lo que necesita el comprobante imprimible:

```json
{
  "id": 2, "numero": "C-000002", "fechaEmision": "...",
  "pago": { "id": 2, "monto": 23000, "metodo": "DEBITO", "fecha": "...",
            "usuario": { "nombre": "Recepción", "email": "..." } },
  "orden": {
    "id": 4, "total": 43000, "pagado": 43000, "saldo": 0,
    "vehiculo": { "patente": "BBCL28", "marca": "Chevrolet", "modelo": "Camaro",
                  "cliente": { "nombre": "Neymar Junior", "rut": "21.745.524-3" } },
    "ordenServicios": [{ "id": 1, "servicioId": 1, "cantidad": 1, "precioUnitario": 25000,
                         "servicio": { "nombre": "Cambio de aceite" } }],
    "ordenProductos": [{ "id": 1, "productoId": 4, "cantidad": 4, "precioUnitario": 4500,
                         "producto": { "nombre": "Aceite 10W40 1L" } }]
  }
}
```
`pagado` y `saldo` son el estado de la orden **hoy** (incluyen todos sus pagos).
`404` con `"Comprobante no encontrado"`.
