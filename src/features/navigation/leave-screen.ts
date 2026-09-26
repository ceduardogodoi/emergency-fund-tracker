import type { ImperativeRouter } from 'expo-router'

/**
 * Where a form goes once its change has landed.
 *
 * Back to wherever the user opened it from. The fallback is for arriving by deep link, where
 * there is no history to return to and `back()` would leave the app on a blank stack.
 *
 * @param router The router the screen is navigating with.
 */
export function leaveScreen(router: ImperativeRouter): void {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace('/')
}
