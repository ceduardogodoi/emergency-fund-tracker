import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Every file under the routes directory is a route, and every route can be mounted.
 *
 * Expo Router's context module matches every `.ts`/`.tsx`/`.js`/`.jsx` file under the root
 * and excludes only `+api`, `+html`, and `+middleware` (`expo-router/_ctx.js`). There is no
 * way to colocate a helper there: it would be mounted as a screen, and a module with no
 * default export renders as "Element type is invalid… got: undefined" — which is exactly
 * what the app did when the router was pointed at `src/app`.
 *
 * Importing rather than reading the source: `export default` in a file is a string, and a
 * string is not a component. This is the component project because these modules reach
 * React Native, which the unit project has no runtime for.
 *
 * `tests/unit/app/router-root.test.ts` covers the other half — that the router is looking
 * at this directory in the first place.
 */
const ROUTES = resolve(__dirname, '../../app')

/** Everything expo-router's `require.context` will pick up. */
const ROUTE_FILE = /\.[jt]sx?$/

const routeFiles = readdirSync(ROUTES, { recursive: true, encoding: 'utf8' }).filter((entry) =>
  ROUTE_FILE.test(entry),
)

describe('the route files', () => {
  it('are all present, so an empty listing cannot pass this suite silently', () => {
    expect(routeFiles).toContain('index.tsx')
    expect(routeFiles).toContain('_layout.tsx')
  })

  it.each(routeFiles)('%s default-exports a component', (file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(join(ROUTES, file)) as { default?: unknown }
    expect(typeof module.default).toBe('function')
  })
})
