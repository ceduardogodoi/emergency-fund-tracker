import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { DesiredDateCard, ForecastCard } from '@/features/forecast/forecast-cards'
import { useForecast } from '@/features/forecast/hooks'
import { MenuButton } from '@/features/navigation/menu-button'
import { ErrorState, LoadingState, Screen, StateView } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Where a user with no goal is sent. There is no target to project onto until setup ends. */
const ONBOARDING = '/onboarding/expenses'

/**
 * The forecast: when the target will be reached at the pace kept, and what a desired date
 * would ask (FR-026 – FR-032).
 *
 * Its four states map one-to-one onto `ForecastState`, so too little history (FR-029) and a
 * pace of zero (FR-030) each say what they are instead of drawing a date that means nothing.
 * Derived from the goal and the ledger on every read, so any entry or goal change moves it
 * (FR-032).
 *
 * @returns The rendered screen
 */
export default function ForecastScreen(): ReactNode {
  const forecast = useForecast()

  return (
    <Screen title={strings.forecast.title} leading={<MenuButton />}>
      <StateView
        state={toViewState(forecast, (data) => data === null)}
        loading={() => <LoadingState />}
        empty={() => <Redirect href={ONBOARDING} />}
        error={(_error, retry) => <ErrorState retry={retry} />}
        // Null is what `empty` above is for, so this branch cannot be reached. Answered with
        // the redirect rather than a cast, as Home does, so it stays correct if that changes.
        ready={(data) =>
          data === null ? (
            <Redirect href={ONBOARDING} />
          ) : (
            <>
              <ForecastCard forecast={data} />
              <DesiredDateCard desired={data.desired} />
            </>
          )
        }
      />
    </Screen>
  )
}
