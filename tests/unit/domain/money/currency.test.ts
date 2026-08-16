import { currencyCode } from '@/domain/money/currency'

describe('currencyCode', () => {
  it('accepts a three-letter uppercase code', () => {
    expect(currencyCode('USD')).toBe('USD')
    expect(currencyCode('BRL')).toBe('BRL')
  })

  it('rejects lowercase, since the code is stored and compared verbatim', () => {
    expect(() => currencyCode('usd')).toThrow()
  })

  it('rejects the wrong length', () => {
    expect(() => currencyCode('US')).toThrow()
    expect(() => currencyCode('USDD')).toThrow()
    expect(() => currencyCode('')).toThrow()
  })

  it('rejects digits and symbols', () => {
    expect(() => currencyCode('US1')).toThrow()
    expect(() => currencyCode('U$D')).toThrow()
  })

  it('accepts a valid-shaped code it does not recognize', () => {
    // Shape only. The ISO register changes, and rejecting an unknown code would lock a
    // user out of their own currency.
    expect(currencyCode('XYZ')).toBe('XYZ')
  })
})
