import type { ReactNode } from 'react'
import { View } from 'react-native'

import { useServices } from '@/runtime/services-context'
import type { SavingStatistics } from '@/domain/statistics/summary'
import { Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Props for the cards below, each of which states part of one period's figures. */
export interface StatisticsCardProps {
  readonly statistics: SavingStatistics
}

/**
 * What went in and out over the period (FR-020).
 *
 * A figure with nothing behind it says so in words rather than as a zero: "largest
 * contribution R$ 0,00" and "average R$ 0,00" both read as facts about how the user saves,
 * when they are facts about how much history there is (FR-025).
 *
 * @param props - See {@link StatisticsCardProps}
 * @returns The rendered card
 */
export function TotalsCard({ statistics }: StatisticsCardProps): ReactNode {
  const { format } = useServices()
  return (
    <Card testID="statistics-totals">
      <Text variant="heading" accessibilityRole="header">
        {strings.statistics.totalsHeading}
      </Text>
      <Figure
        label={strings.statistics.totalContributed}
        value={format.money(statistics.totalContributed)}
        testID="figure-total-contributed"
      />
      <Figure
        label={strings.statistics.totalWithdrawn}
        value={format.money(statistics.totalWithdrawn)}
        testID="figure-total-withdrawn"
      />
      <Figure
        label={strings.statistics.netSaved}
        value={format.money(statistics.netSaved)}
        testID="figure-net-saved"
      />
      <ContributionFigures statistics={statistics} />
    </Card>
  )
}

/** How many contributions, the largest, and the average per month. */
function ContributionFigures({ statistics }: StatisticsCardProps): ReactNode {
  const { format } = useServices()
  const { largestContribution, averageMonthlyContribution } = statistics
  return (
    <>
      <Figure
        label={strings.statistics.contributionCount}
        value={String(statistics.contributionCount)}
        testID="figure-contribution-count"
      />
      <Figure
        label={strings.statistics.largestContribution}
        value={largestContribution === null ? null : format.money(largestContribution)}
        absent={strings.statistics.noContribution}
        testID="figure-largest-contribution"
      />
      <Figure
        label={strings.statistics.averageContribution}
        value={
          averageMonthlyContribution === null ? null : format.money(averageMonthlyContribution)
        }
        detail={strings.statistics.averageBasis(statistics.completeMonths)}
        absent={strings.statistics.averageUnavailable}
        testID="figure-average-contribution"
      />
    </>
  )
}

/**
 * How steadily the user has saved, within the period (FR-021).
 *
 * @param props - See {@link StatisticsCardProps}
 * @returns The rendered card
 */
export function StreaksCard({ statistics }: StatisticsCardProps): ReactNode {
  return (
    <Card testID="statistics-streaks">
      <Text variant="heading" accessibilityRole="header">
        {strings.statistics.streaksHeading}
      </Text>
      <Text tone="secondary">{strings.statistics.streaksHelp}</Text>
      <Figure
        label={strings.statistics.currentStreak}
        value={strings.statistics.streak(statistics.currentStreak)}
        testID="figure-current-streak"
      />
      <Figure
        label={strings.statistics.longestStreak}
        value={strings.statistics.streak(statistics.longestStreak)}
        testID="figure-longest-streak"
      />
    </Card>
  )
}

/** Props for {@link Figure}. */
interface FigureProps {
  /** What the figure is. */
  readonly label: string
  /** The figure, formatted — or null when there is nothing to state yet. */
  readonly value: string | null
  /** A caption under the figure, such as what it divides by. Shown only with a value. */
  readonly detail?: string
  /** What to say in place of a figure that does not exist yet. */
  readonly absent?: string
  /** Exposes the element to tests. */
  readonly testID: string
}

/**
 * One labelled figure: the label first, the way it is read, then the value.
 *
 * A value that does not exist yet is replaced by a sentence saying why, never by zero.
 */
function Figure({ label, value, detail, absent, testID }: FigureProps): ReactNode {
  return (
    <View testID={testID}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      {value === null ? (
        <Text>{absent}</Text>
      ) : (
        <>
          <Text variant="title" numeric>
            {value}
          </Text>
          {detail === undefined ? null : (
            <Text variant="caption" tone="secondary">
              {detail}
            </Text>
          )}
        </>
      )}
    </View>
  )
}
