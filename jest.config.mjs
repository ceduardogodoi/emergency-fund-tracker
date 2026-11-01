/**
 * Three projects matching the test pyramid in constitution Principle IV:
 *   unit        — pure domain, no I/O, must stay fast
 *   integration — real SQLite via better-sqlite3 in Node (research D-006)
 *   component   — screens and primitives via Testing Library
 *
 * Coverage floors are enforced here rather than by review: 80% global, 95% on the
 * modules the constitution names — money, dates, statistics, and forecast.
 */

/**
 * Path aliases, mirrored from tsconfig.json. Kept in both places because Jest resolves
 * modules itself and does not read tsconfig `paths`.
 *
 * @type {NonNullable<import('jest').Config['moduleNameMapper']>}
 */
const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@tests/(.*)$': '<rootDir>/tests/$1',
}

/**
 * Unit and integration tests run as plain Node with no React Native runtime — which is
 * what keeps them fast enough to run on every save. Only the component project pays for
 * the full RN preset.
 *
 * @type {NonNullable<import('jest').Config['transform']>}
 */
const nodeTransform = {
  '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
}

/**
 * Runs before every project, pinning the timezone so a UTC assumption fails in CI rather
 * than on a user's device. See the file itself for why it is not UTC.
 *
 * @type {NonNullable<import('jest').Config['setupFiles']>}
 */
const setupFiles = ['<rootDir>/tests/support/set-timezone.cjs']

/** @type {import('jest').Config} */
export default {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      setupFiles,
      transform: nodeTransform,
      moduleNameMapper,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles,
      transform: nodeTransform,
      moduleNameMapper,
    },
    {
      displayName: 'component',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/tests/component/**/*.test.tsx'],
      setupFiles,
      moduleNameMapper,
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/index.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
    './src/domain/money/': { statements: 95, branches: 95, functions: 95, lines: 95 },
    './src/domain/dates/': { statements: 95, branches: 95, functions: 95, lines: 95 },
    './src/domain/statistics/': { statements: 95, branches: 95, functions: 95, lines: 95 },
    './src/domain/forecast/': { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
}
