import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState, type ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { createQueryClient } from '@/runtime/query'
import { ServicesProvider } from '@/runtime/services-context'
import { useBootstrap } from '@/runtime/use-bootstrap'
import type { Services } from '@/runtime/services'
import { FONTS } from '@/ui/fonts'
import { ErrorState, LoadingState, Screen, StateView } from '@/ui/primitives'
import { color, typography } from '@/ui/tokens'

/**
 * The root of every screen in the app.
 *
 * Nothing below this renders until the database is open and migrated, because every screen
 * reads through the services and a provider holding none would be a lie the type system
 * cannot catch. The wait is the four-state contract applied to the app itself — the same
 * `StateView` every other view uses, with the same loading and error treatments.
 *
 * @returns The provider stack wrapping the router, or the boot state until it is ready
 */
export default function RootLayout(): ReactNode {
  // The initializer is passed, not called: React runs it once on mount rather than on
  // every render. The setter is deliberately unused — `useState` is here for its
  // create-once guarantee, not for state. `useMemo` would not do: React documents it as a
  // performance hint that may discard its cached value, and a discarded query client is
  // every screen's data silently evicted.
  const [queryClient] = useState(createQueryClient)
  const boot = useBootstrap()
  // Every type style names an Archivo family, so text drawn before these resolve would be
  // laid out in the system face and jump when they land. Waiting is the honest option:
  // the database is opening behind the same spinner anyway.
  const [fontsLoaded, fontError] = useFonts(FONTS)

  return (
    // `app-root` is what `e2e/smoke.yaml` asserts: the outermost element that exists on
    // every screen and in every boot state, so the smoke flow proves the app mounted
    // without depending on which screen it settled on.
    <SafeAreaProvider testID="app-root">
      {/* Dark glyphs: research decision D-018 ships one light theme, so the status bar is
          never on a dark ground and `auto` would have nothing to switch between. */}
      <StatusBar style="dark" />
      <StateView
        state={boot}
        loading={() => (
          <Screen>
            <LoadingState />
          </Screen>
        )}
        // Unreachable: `useBootstrap` produces only loading, error, and ready. The renderer
        // is required by the type rather than defaulted, so this is what saying "there is
        // no empty case here" looks like.
        empty={() => (
          <Screen>
            <ErrorState />
          </Screen>
        )}
        error={(_error, retry) => (
          <Screen>
            <ErrorState retry={retry} />
          </Screen>
        )}
        ready={(services) => (
          <AppShell
            services={services}
            queryClient={queryClient}
            fontsLoaded={fontsLoaded}
            fontError={fontError}
          />
        )}
      />
    </SafeAreaProvider>
  )
}

/** Props for {@link AppShell}. */
interface AppShellProps {
  readonly services: Services
  readonly queryClient: QueryClient
  readonly fontsLoaded: boolean
  readonly fontError: Error | null
}

/**
 * The app itself, once the database is open: the providers, and the router inside them.
 *
 * It holds the second half of the wait. The typeface has to land before the first screen
 * draws — every type style names an Archivo family, and text laid out in the system face
 * would reflow when the real one arrives — but a font is not worth failing to open on. So
 * a failure here is survived rather than raised: React Native falls back to the system
 * face for a family it cannot resolve, and the app looks ordinary instead of being
 * unopenable. Principle II forbids a swallowed failure, not one the app chooses to
 * survive, which is why it is still recorded before the screen appears.
 *
 * @param props - See {@link AppShellProps}
 * @returns The router inside its providers, or the loading state until the fonts settle
 */
function AppShell({ services, queryClient, fontsLoaded, fontError }: AppShellProps): ReactNode {
  const message = fontError?.message
  useEffect(() => {
    if (message !== undefined) {
      services.logger.warn('fonts.load-failed', { message })
    }
  }, [message, services])

  if (!fontsLoaded && fontError === null) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    )
  }

  return (
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={SCREEN_OPTIONS} />
      </QueryClientProvider>
    </ServicesProvider>
  )
}

/**
 * Navigation chrome, drawn from the same tokens as everything else.
 *
 * Set once here rather than per screen: the header is the one surface every screen shares,
 * and a per-screen override is how a design system starts to drift (Principle VI).
 *
 * Hidden by default because `Screen` renders each page's own title, as a heading a screen
 * reader can navigate by. Left visible, the navigator would draw a second title above it —
 * and the one it draws is the route's file name. A route that needs a header opts in with
 * `headerShown: true` and inherits the styling below, which is why that styling stays here
 * rather than leaving with the header.
 */
const SCREEN_OPTIONS = {
  headerShown: false,
  headerStyle: { backgroundColor: color.background.page },
  headerTintColor: color.text.primary,
  headerTitleStyle: {
    fontFamily: typography.heading.fontFamily,
    fontSize: typography.heading.fontSize,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: color.background.page },
} as const
