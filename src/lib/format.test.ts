import { describe, expect, it } from 'vitest'
import { formatPhone, fromLocalInput, money, toLocalInput, whatsappLink } from './format'
import { toAppError } from './errors'
import { validateSignup } from '@/pages/auth/Signup'
import { validateShipment } from '@/pages/account/Stored'
import { safeNext } from '@/pages/auth/Login'

describe('formatting', () => {
  it('formats BRL with tabular-friendly output', () => {
    expect(money(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
    expect(money(null)).toBe('—')
  })
  it('round-trips São Paulo wall clock for datetime inputs', () => {
    const iso = '2026-11-10T22:00:00.000Z'
    expect(toLocalInput(iso)).toBe('2026-11-10T19:00')
    expect(fromLocalInput('2026-11-10T19:00')).toBe(iso)
  })
  it('formats phones and builds wa.me links with country code', () => {
    expect(formatPhone('41999990000')).toBe('(41) 99999-0000')
    expect(whatsappLink('(41) 99999-0000', 'oi')).toBe('https://wa.me/5541999990000?text=oi')
  })
})

describe('error mapping', () => {
  it('maps server codes to friendly messages', () => {
    expect(toAppError(new Error('LOT_ENDED')).message).toMatch(/horário de encerramento/)
    expect(toAppError(new Error('Failed to fetch')).code).toBe('NETWORK')
    expect(toAppError(new Error('Invalid login credentials')).message).toBe('E-mail ou senha incorretos.')
  })
})

describe('form validation', () => {
  it('sign-up requires full name, e-mail, WhatsApp, 8+ char password and consent', () => {
    expect(Object.keys(validateSignup({ name: 'Ana', email: 'x', phone: '12', password: '123', accepted: false })).sort()).toEqual(['accepted', 'email', 'name', 'password', 'phone'])
    expect(validateSignup({ name: 'Ana Costa', email: 'ana@x.com', phone: '(41) 99999-0000', password: '12345678', accepted: true })).toEqual({})
  })
  it('shipping needs a full address; pickup does not', () => {
    const empty = { name: '', cep: '', street: '', number: '', city: '', state: '' }
    expect(Object.keys(validateShipment('shipping', empty)).length).toBe(6)
    expect(validateShipment('pickup', empty)).toEqual({})
    expect(validateShipment('shipping', { name: 'Ana Costa', cep: '80000-000', street: 'Rua X', number: '10', city: 'Curitiba', state: 'PR' })).toEqual({})
  })
  it('login redirect only allows same-site paths', () => {
    expect(safeNext('/conta/pedidos')).toBe('/conta/pedidos')
    expect(safeNext('//evil.com')).toBe('/conta')
    expect(safeNext('https://evil.com')).toBe('/conta')
    expect(safeNext(null)).toBe('/conta')
  })
})
