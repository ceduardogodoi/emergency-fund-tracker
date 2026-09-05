import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import appConfig from '../../../app.json'

/**
 * Where Expo Router looks for routes.
 *
 * It has two conventions and prefers the more specific one: given a `src/app` directory it
 * uses that and ignores `app/` entirely. This project used to have both — `src/app` held
 * the composition root, the query layer, and the services context, none of them a screen —
 * so the router treated those five modules as the app's routes. There was no `index`, and
 * none of them has a default export: iOS showed "Unmatched Route" and Android threw
 * "Element type is invalid… got: undefined".
 *
 * That directory is `src/runtime/` now, so the default resolution lands on `app/` whether
 * or not anyone remembers the setting. The setting stays as a statement of intent, and
 * these tests keep both halves honest.
 *
 * Nothing else in the suite could catch this. Component tests import each screen directly,
 * so they pass while the router is pointed somewhere else entirely — which is exactly what
 * happened. This asks the question a device asks; `tests/component/routes.test.tsx` asks
 * the other half, that what it finds there can actually be mounted.
 */
const PROJECT_ROOT = resolve(__dirname, '../../..')

describe('the Expo Router root', () => {
  const configured = appConfig.expo.extra.router.root
  const routes = resolve(PROJECT_ROOT, configured)

  it('is stated explicitly rather than inferred from the directory layout', () => {
    expect(configured).toBe('./app')
  })

  it('names a directory that actually holds the routes', () => {
    expect(existsSync(join(routes, '_layout.tsx'))).toBe(true)
    expect(existsSync(join(routes, 'index.tsx'))).toBe(true)
  })

  // `src/app` would win over the setting's absence, and the failure is silent until a
  // device renders it. Keeping that name free is what makes the default correct too.
  it('does not compete with a src/app directory', () => {
    expect(existsSync(join(PROJECT_ROOT, 'src', 'app'))).toBe(false)
  })
})
