import type { CalendarDate, MonthKey } from '@/domain/dates/calendar-date'
import type { CurrencyCode } from '@/domain/money/currency'
import type { Money } from '@/domain/money/money'

/**
 * A calendar date carries no time and no zone, so it is rendered in one — UTC — and built
 * from its own digits rather than parsed. Left to the device zone, the first of a month
 * shows as the last day of the previous one for every user west of Greenwich.
 */
const CALENDAR_ZONE = 'UTC'

/** What the formatters are bound to for the life of the session. */
export interface FormatterOptions {
  /** The currency chosen at setup. Fixed until the fund is erased (FR-039). */
  readonly currency: CurrencyCode
  /** BCP 47 tag. Omit to follow the device locale, which is the production path. */
  readonly locale?: string
}

/**
 * The app's only way to turn stored values into text a person reads.
 *
 * The UI contract holds that no component formats money itself. That is not a style
 * preference: a component that formats its own would have to know the currency's exponent,
 * and the second place that knowledge lives is where the two start to disagree.
 */
export interface Formatters {
  /**
   * Renders an amount in the profile's currency and the device locale.
   *
   * @param amount Minor units, as stored.
   */
  money(amount: Money): string

  /**
   * Renders a calendar date as the day the user chose, in every timezone.
   *
   * @param value The stored `YYYY-MM-DD` date.
   */
  date(value: CalendarDate): string

  /**
   * Renders a month bucket for the per-month breakdown (FR-022).
   *
   * @param key The stored `YYYY-MM` bucket key.
   */
  month(key: MonthKey): string
}

/**
 * Builds the formatters once, for the composition root to share.
 *
 * The `Intl` objects are constructed here rather than per call because they are expensive
 * to build and are used on every row of a long ledger.
 *
 * The currency's exponent is read from `Intl` rather than assumed to be two. Yen has no
 * minor unit and Kuwaiti dinars have three, so a hard-coded division by 100 would render
 * ¥1,234 as ¥12 and 1.234 KWD as 12.340 — wrong by orders of magnitude, in the direction
 * a user would not immediately notice.
 */
export function createFormatters({ currency, locale }: FormatterOptions): Formatters {
  const currencyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency })
  // Always populated under `style: 'currency'`. The fallback exists to satisfy the type,
  // which marks it optional because other number styles may leave it unset.
  const exponent = currencyFormat.resolvedOptions().maximumFractionDigits ?? 2
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: CALENDAR_ZONE,
  })
  const monthFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: CALENDAR_ZONE,
  })

  return {
    // Division reaches floating point, which FR-038 permits for display alone — the stored
    // integer is untouched and no calculation reads this result back.
    money: (amount) => currencyFormat.format(amount / 10 ** exponent),
    date: (value) => dateFormat.format(toUtcDate(value)),
    month: (key) => monthFormat.format(toUtcDate(`${key}-01`)),
  }
}

/**
 * Builds a `Date` fixed at UTC midnight on the given calendar day.
 *
 * Reads the digits by position instead of handing the string to the `Date` constructor.
 * The parse would happen to work for this format today, but it is the same call that
 * silently accepts a dozen other shapes and resolves several of them in local time.
 *
 * @param value A `YYYY-MM-DD` date. Its shape is guaranteed by the `CalendarDate` brand.
 */
function toUtcDate(value: string): Date {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day))
}
