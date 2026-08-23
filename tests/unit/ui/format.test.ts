import { calendarDate } from '@/domain/dates/calendar-date'
import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import { createFormatters } from '@/ui/format'

/**
 * The UI contract says money renders through exactly one formatter and no component
 * formats it itself. This is that formatter, so these tests are the whole of what the app
 * knows about turning a stored value into something a person reads.
 *
 * Two properties carry the weight. Minor units must be placed by the currency's own
 * exponent rather than by assuming two decimals — yen has none and dinars have three, and
 * a hard-coded ÷100 misprices both by orders of magnitude. And a calendar date must render
 * as the day the user chose, in every timezone, which is why the suite runs at UTC−3.
 */
describe('formatters', () => {
  /**
   * ICU separates a currency symbol from its amount with a non-breaking space. Comparing
   * against a typed space would fail for a reason that has nothing to do with the code.
   */
  function normalize(text: string): string {
    return text.replace(/ /g, ' ')
  }

  /** A formatter bound to one currency and locale, the way the composition root builds it. */
  function formatters(currency: string, locale: string) {
    return createFormatters({ currency: currencyCode(currency), locale })
  }

  describe('money', () => {
    it('places the decimal by the currency exponent', () => {
      expect(formatters('USD', 'en-US').money(money(123_45))).toBe('$123.45')
    })

    it('renders zero with its decimals, so an empty fund does not read as "$0"', () => {
      expect(formatters('USD', 'en-US').money(money(0))).toBe('$0.00')
    })

    it('groups thousands', () => {
      expect(formatters('USD', 'en-US').money(money(1_234_567_89))).toBe('$1,234,567.89')
    })

    it('marks a negative amount, which a net figure can legitimately be', () => {
      expect(formatters('USD', 'en-US').money(money(-5_00))).toBe('-$5.00')
    })

    it('follows the locale, not the currency, for separators and symbol placement', () => {
      expect(normalize(formatters('BRL', 'pt-BR').money(money(123_45)))).toBe('R$ 123,45')
    })

    it('shows no decimals for a zero-exponent currency, where the minor unit is the unit', () => {
      expect(formatters('JPY', 'en-US').money(money(1_234))).toBe('¥1,234')
    })

    it('shows three decimals for a three-exponent currency', () => {
      expect(normalize(formatters('KWD', 'en-US').money(money(1_234)))).toBe('KWD 1.234')
    })
  })

  describe('date', () => {
    it('renders the calendar date the user chose', () => {
      expect(formatters('USD', 'en-US').date(calendarDate('2026-03-10'))).toBe('Mar 10, 2026')
    })

    it('does not slip to the previous day west of Greenwich', () => {
      // The suite runs at UTC−3. A formatter that builds its Date from local parts, or
      // renders in the device zone, reports this one as 28 February.
      expect(formatters('USD', 'en-US').date(calendarDate('2026-03-01'))).toBe('Mar 1, 2026')
    })

    it('does not slip to the next day east of Greenwich either', () => {
      expect(formatters('USD', 'en-US').date(calendarDate('2026-12-31'))).toBe('Dec 31, 2026')
    })

    it('renders a leap day', () => {
      expect(formatters('USD', 'en-US').date(calendarDate('2028-02-29'))).toBe('Feb 29, 2028')
    })

    it('follows the locale', () => {
      expect(formatters('BRL', 'pt-BR').date(calendarDate('2026-03-10'))).toBe('10 de mar. de 2026')
    })
  })

  describe('month', () => {
    it('names the month and year, for the per-month breakdown (FR-022)', () => {
      expect(formatters('USD', 'en-US').month('2026-03')).toBe('March 2026')
    })

    it('renders January without slipping into the previous year', () => {
      expect(formatters('USD', 'en-US').month('2026-01')).toBe('January 2026')
    })

    it('follows the locale', () => {
      expect(formatters('BRL', 'pt-BR').month('2026-03')).toBe('março de 2026')
    })
  })
})
