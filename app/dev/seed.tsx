import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, type ReactNode } from 'react'

import { parseSeedRequest, type SeedRequest } from '@/features/dev/seed-history'
import { useSeed } from '@/features/dev/use-seed'
import { Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Where `npm run seed` lands (T087): erases the store and writes a synthetic fund, or
 * only erases for `--reset`, then goes Home.
 *
 * A route because a link is the one way a script on the computer can reach the app's own
 * storage on any device running the development server. Expo Router turns every file under
 * `app/` into a route in every build, so outside development this one goes Home and does
 * nothing else: a link must never be able to erase a user's fund.
 *
 * @returns The rendered screen
 */
export default function SeedScreen(): ReactNode {
  const params = useLocalSearchParams()
  if (!__DEV__) {
    return <Redirect href="/" />
  }

  const request = parseSeedRequest(params)
  return (
    <Screen title={strings.dev.seedTitle}>
      {request.kind === 'invalid' ? (
        <Text>{strings.dev.seedProblems[request.problem]}</Text>
      ) : (
        <Seeding request={request} />
      )}
    </Screen>
  )
}

/** Props for {@link Seeding}. */
interface SeedingProps {
  /** What the link asked for. */
  readonly request: SeedRequest
}

/**
 * Runs the request once, on arrival.
 *
 * The ref is what makes it once. The effect's dependencies are new on every render — the
 * request is parsed afresh, and the mutation object changes with its own state — so the
 * effect re-runs each time the seed's progress re-renders the screen. Unguarded, one link
 * seeded 2 835 times in 300ms in the component test, each run erasing the one before.
 */
function Seeding({ request }: SeedingProps): ReactNode {
  const router = useRouter()
  const seed = useSeed()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true
    seed.mutate(request, {
      onSuccess: () => {
        router.replace('/')
      },
    })
  }, [request, router, seed])

  return <Text>{seed.isError ? strings.dev.seedFailed : strings.dev.seeding}</Text>
}
