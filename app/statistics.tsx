import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { Period } from '@/domain/statistics/period'
import { MonthBreakdown } from '@/features/statistics/month-breakdown'
import { coverage, PeriodFilter, periodName } from '@/features/statistics/period-filter'
import { StreaksCard, TotalsCard } from '@/features/statistics/statistics-cards'
import { useStatistics, type StatisticsView } from '@/features/statistics/use-statistics'
import { Button, Card, Screen, StateView, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** All time, which is where the screen opens: the whole story before any slice of it. */
const DEFAULT_PERIOD: Period = { kind: 'all-time' }

/**
 * Statistics: how the user has been saving, over a period they choose (FR-019 – FR-025).
 *
 * Every figure is derived from the ledger on each read and filtered to the same period, so
 * the totals, the streaks, and the month-by-month list can never describe different spans.
 * The period is screen state rather than stored: it is a way of looking, not a setting.
 *
 * @returns The rendered screen
 */
export default function StatisticsScreen(): ReactNode {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const statistics = useStatistics(period)

  return (
    <Screen title={strings.statistics.title}>
      <StateView
        state={toViewState(statistics, (view) => !view.hasMovements)}
        empty={() => <EmptyStatistics />}
        ready={(view) => <StatisticsBody view={view} period={period} onSelect={setPeriod} />}
      />
    </Screen>
  )
}

/** Props for {@link StatisticsBody}. */
interface StatisticsBodyProps {
  readonly view: StatisticsView
  readonly period: Period
  readonly onSelect: (period: Period) => void
}

/** The filter, the period it chose, and the figures for that period. */
function StatisticsBody({ view, period, onSelect }: StatisticsBodyProps): ReactNode {
  const { format } = useServices()
  const { statistics } = view
  return (
    <>
      <PeriodFilter options={view.options} selected={period} onSelect={onSelect} />
      <Card testID="statistics-period">
        <Text variant="heading" accessibilityRole="header">
          {periodName(period)}
        </Text>
        <Text tone="secondary">{coverage(statistics.months, format)}</Text>
      </Card>
      {statistics.months.length === 0 ? (
        <Card testID="statistics-period-empty">
          <Text>{strings.statistics.periodEmpty}</Text>
        </Card>
      ) : (
        <>
          <TotalsCard statistics={statistics} />
          <StreaksCard statistics={statistics} />
          <MonthBreakdown months={statistics.breakdown} today={view.today} />
        </>
      )}
    </>
  )
}

/**
 * Before the first contribution (FR-025): what this screen will show, and the action that
 * makes it show it.
 */
function EmptyStatistics(): ReactNode {
  const router = useRouter()
  return (
    <Card testID="statistics-empty">
      <Text variant="heading" accessibilityRole="header">
        {strings.statistics.emptyTitle}
      </Text>
      <Text tone="secondary">{strings.statistics.emptyBody}</Text>
      <Button
        label={strings.home.contributeAction}
        onPress={() => {
          router.push('/entries/contribute')
        }}
        testID="contribute"
      />
    </Card>
  )
}
