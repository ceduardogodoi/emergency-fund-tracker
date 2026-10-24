/**
 * Fills the app on a booted emulator or simulator with a synthetic fund, or empties it (T087).
 *
 *   npm run seed -- --months 8 --pattern steady
 *   npm run seed -- --months 8 --pattern erratic
 *   npm run seed -- --reset
 *
 * The app keeps its data inside Expo Go on the device, out of this script's reach, so the
 * script does not write anything itself. It opens a link to the development-only route
 * `app/dev/seed.tsx`, which erases the store and writes the fund through the app's own
 * rules. That route also checks the values; this script only checks which flags it was
 * given, so a typo fails here rather than as a link that does something unexpected.
 *
 * Needs the development server running (`npm start`). On Android, after an emulator
 * restart, `adb reverse tcp:8081 tcp:8081` first — see `.claude/rules/tooling.md`.
 * For a physical phone, open the printed link on it instead.
 *
 * Runs under Node's type stripping, so it imports nothing from `src/`: Node cannot resolve
 * the `@/` paths, and the route is the one place the rules live.
 */
import { execFileSync } from 'node:child_process'

/** The development server, as the e2e flows reach it. Override with SEED_DEV_URL. */
const DEV_URL = process.env['SEED_DEV_URL'] ?? 'exp://127.0.0.1:8081'

/** Expo Go's package on Android, which the link is handed to. */
const ANDROID_PACKAGE = 'host.exp.exponent'

const USAGE = `Usage:
  npm run seed -- --months <1-120> [--pattern steady|erratic]
  npm run seed -- --reset`

/** Turns the flags into the route's query string, refusing any flag the route does not read. */
function queryFrom(args: readonly string[]): URLSearchParams {
  const query = new URLSearchParams()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--reset') {
      query.set('reset', '1')
    } else if (flag === '--months' || flag === '--pattern') {
      const value = args[index + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${flag} needs a value.`)
      }
      query.set(flag.slice(2), value)
      index += 1
    } else {
      throw new Error(`Unknown option: ${flag}`)
    }
  }
  if (!query.has('months') && !query.has('reset')) {
    throw new Error('Say how many months to seed, or --reset.')
  }
  return query
}

/** The serials of every Android device adb can reach. None when adb is not installed. */
function androidDevices(): readonly string[] {
  try {
    return execFileSync('adb', ['devices'], { encoding: 'utf8' })
      .split('\n')
      .slice(1)
      .map((line) => line.split('\t'))
      .filter(([, state]) => state?.trim() === 'device')
      .map(([serial]) => serial ?? '')
  } catch {
    return []
  }
}

/** Whether an iOS simulator is booted. False when Xcode's tools are not installed. */
function iosSimulatorBooted(): boolean {
  try {
    return execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], {
      encoding: 'utf8',
    }).includes('(Booted)')
  } catch {
    return false
  }
}

function main(): void {
  let query: URLSearchParams
  try {
    query = queryFrom(process.argv.slice(2))
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`)
    process.exit(1)
  }

  const link = `${DEV_URL}/--/dev/seed?${query.toString()}`
  const android = androidDevices()
  const ios = iosSimulatorBooted()
  if (android.length === 0 && !ios) {
    console.error(`No emulator or simulator is running. Open this link on the device:\n${link}`)
    process.exit(1)
  }

  for (const serial of android) {
    // The remote shell would split the query at `&`, so the link is quoted for it.
    execFileSync('adb', [
      '-s',
      serial,
      'shell',
      `am start -a android.intent.action.VIEW -d '${link}' ${ANDROID_PACKAGE}`,
    ])
    console.log(`Android ${serial}: ${link}`)
  }
  if (ios) {
    execFileSync('xcrun', ['simctl', 'openurl', 'booted', link])
    console.log(`iOS simulator: ${link}`)
  }
}

main()
