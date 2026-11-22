import { describe, it, expect } from 'vitest'
import {
  desglosarIva,
  totalLineas,
  fechaLocal,
  fechaVencimiento,
  estadoPresupuesto,
  resumenPagos,
  validarMonto,
  hoyIso
} from '../presupuestos'

describe('desglosarIva', () => {
  it('separa un total con IVA incluido en neto + IVA', () => {
    expect(desglosarIva(11900)).toEqual({ neto: 10000, iva: 1900, total: 11900 })
  })

  it('neto + IVA siempre suma exactamente el total, aunque haya redondeo', () => {
    for (const total of [1, 999, 25000, 43000, 123457]) {
      const { neto, iva } = desglosarIva(total)
      expect(neto + iva).toBe(total)
    }
  })

  it('un total vacío da 0', () => {
    expect(desglosarIva(undefined)).toEqual({ neto: 0, iva: 0, total: 0 })
  })
})

describe('totalLineas', () => {
  it('suma cantidad × precio de cada línea', () => {
    expect(
      totalLineas([
        { cantidad: 1, precioUnitario: 25000 },
        { cantidad: 4, precioUnitario: 4500 }
      ])
    ).toBe(43000)
  })
})

describe('fechas del presupuesto', () => {
  it('no corre la fecha un día hacia atrás por la zona horaria', () => {
    const f = fechaLocal('2026-11-11T00:00:00.000Z')
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 10, 11])
  })

  it('calcula el vencimiento sumando los días de validez', () => {
    const v = fechaVencimiento({ fecha: '2026-11-11T00:00:00.000Z', validezDias: 15 })
    expect(hoyIso(v)).toBe('2026-11-26')
  })
})

describe('estadoPresupuesto', () => {
  const p = { estado: 'PENDIENTE', fecha: '2026-11-01T00:00:00.000Z', validezDias: 15 }

  it('sigue pendiente el último día de validez', () => {
    expect(estadoPresupuesto(p, new Date(2026, 10, 16, 18, 0))).toBe('PENDIENTE')
  })

  it('pasa a vencido al día siguiente', () => {
    expect(estadoPresupuesto(p, new Date(2026, 10, 17, 9, 0))).toBe('VENCIDO')
  })

  it('un presupuesto aprobado nunca se muestra vencido', () => {
    expect(estadoPresupuesto({ ...p, estado: 'APROBADO' }, new Date(2027, 0, 1))).toBe('APROBADO')
  })
})

describe('pagos', () => {
  it('calcula lo pagado y el saldo', () => {
    expect(resumenPagos(43000, [{ monto: 20000 }, { monto: 3000 }])).toEqual({
      total: 43000,
      pagado: 23000,
      saldo: 20000,
      pagadoCompleto: false
    })
  })

  it('marca la orden como pagada cuando el saldo llega a 0', () => {
    expect(resumenPagos(43000, [{ monto: 43000 }]).pagadoCompleto).toBe(true)
  })

  it('rechaza montos inválidos o mayores al saldo', () => {
    expect(validarMonto('', 1000)).not.toBe('')
    expect(validarMonto(0, 1000)).not.toBe('')
    expect(validarMonto(10.5, 1000)).not.toBe('')
    expect(validarMonto(1500, 1000)).toBe('El monto no puede ser mayor que el saldo pendiente')
    expect(validarMonto(1000, 1000)).toBe('')
  })
})
