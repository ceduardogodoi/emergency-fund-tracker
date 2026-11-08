/**
 * Stands in for the native halves of the gesture and animation libraries the drawer is
 * built on, for the component project only.
 *
 * Expo Router's drawer imports `react-native-reanimated`, which imports
 * `react-native-worklets`, which reaches for its native module as soon as it loads. Jest
 * has no native modules, so without these a test fails before it starts — measured while
 * planning (specs/002-drawer-navigation/research.md, D-007) as `Cannot read properties of
 * undefined (reading 'loadUnpackers')`. Each library ships its own mock, used here as it
 * is rather than imitated.
 *
 * A setup file rather than mocks in each test because the mocks have to be in place before
 * a test file's imports run, and `jest.mock` calls inside a required helper are not hoisted
 * above them. They are project-wide because `tests/component/routes.test.tsx` loads every
 * route file, and the drawer's layout is one. Kept as CommonJS because Jest loads setup
 * files synchronously.
 */
require('react-native-gesture-handler/jestSetup')

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'))
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
