import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState, type ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { createServices } from '@/app/composition-root'
import { createQueryClient } from '@/app/query'
import { ServicesProvider } from '@/app/services-context'
import { color, typography } from '@/ui/tokens'

/**
 * The root of every screen in the app, and the only module that builds the services.
 *
 * @returns The provider stack wrapping the router
 */
export default function RootLayout(): ReactNode {
  // The initializer is passed, not called: React runs it once on mount rather than on
  // every render. The setters are deliberately unused — `useState` is here for its
  // create-once guarantee, not for state. `useMemo` would not do: React documents it as a
  // performance hint that may discard its cached value, and a discarded query client is
  // every screen's data silently evicted. Building either inline would hand every render a
  // new clock and an empty cache.
  const [services] = useState(createServices)
  const [queryClient] = useState(createQueryClient)

  return (
    <SafeAreaProvider>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          {/* Dark glyphs: research decision D-018 ships one light theme, so the status bar
              is never on a dark ground and `auto` would have nothing to switch between. */}
          <StatusBar style="dark" />
          <Stack screenOptions={SCREEN_OPTIONS} />
        </QueryClientProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  )
}

/**
 * Navigation chrome, drawn from the same tokens as everything else.
 *
 * Set once here rather than per screen: the header is the one surface every screen shares,
 * and a per-screen override is how a design system starts to drift (Principle VI).
 */
const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: color.background.page },
  headerTintColor: color.text.primary,
  headerTitleStyle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: color.background.page },
} as const
