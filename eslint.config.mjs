// Flat ESLint config. Warnings are errors — the `lint` script passes --max-warnings=0.
// Explicit `.js`: the package ships both a `flat/` directory and `flat.js`, and ESM
// resolution will not pick between them the way CommonJS did.
import expoConfig from 'eslint-config-expo/flat.js'
// Named imports rather than the default namespace: reaching through the default export
// for `configs` trips import/no-named-as-default-member.
import { config as defineConfig, configs as tsConfigs } from 'typescript-eslint'

/**
 * Style properties whose value must come from the spacing scale.
 *
 * Written as an esquery regex against the property name. The selectors below match a
 * numeric literal *anywhere beneath* the property rather than only as its direct value,
 * so `padding: cond ? 4 : 8` and `padding: base + 4` are caught alongside `padding: 12`.
 *
 * Zero is deliberately not exempt. `spacing.none` and `radius.none` exist precisely so a
 * deliberate zero is distinguishable from a value someone forgot to fill in, and exempting
 * `0` here would undo that.
 */
const SPACING_PROPERTIES =
  '/^(margin|padding)(Top|Right|Bottom|Left|Horizontal|Vertical|Start|End)?$|^(row|column)?[Gg]ap$/'

/** Style properties whose value must come from the radius scale. */
const RADIUS_PROPERTIES = '/^border(Top|Bottom)?(Left|Right|Start|End)?Radius$/'

/** Border widths, which say where a control ends and which option is chosen. */
const BORDER_WIDTH_PROPERTIES = '/^border(Top|Bottom|Left|Right|Start|End)?Width$/'

/**
 * Interaction opacity. Anchored on both ends so `shadowOpacity`, which belongs to the
 * elevation tokens rather than to a control's state, is not caught by it.
 */
const OPACITY_PROPERTIES = '/^opacity$/'

/**
 * Type sizes, which come from `typography` rather than a bare number so that every screen
 * scales together with the reader's text-size setting.
 */
const TYPE_SIZE_PROPERTIES = '/^(fontSize|lineHeight)$/'

/**
 * Layers this project forbids `src/domain` from importing. Constitution Principle III
 * requires domain logic to depend on abstractions it owns, never on framework, vendor,
 * or adapter types. This rule is what makes that structural rather than aspirational.
 */
const FORBIDDEN_IN_DOMAIN = [
  { group: ['react', 'react/*'], message: 'src/domain must not depend on React.' },
  {
    group: ['react-native', 'react-native-*'],
    message: 'src/domain must not depend on React Native.',
  },
  { group: ['expo', 'expo-*', '@expo/*'], message: 'src/domain must not depend on Expo.' },
  { group: ['@tanstack/*'], message: 'src/domain must not depend on the query layer.' },
  { group: ['better-sqlite3'], message: 'src/domain must not depend on a database driver.' },
  {
    group: ['@/data/*', '@/platform/*', '@/ui/*', '@/features/*', '@/runtime/*'],
    message: 'Dependencies point inward. src/domain may not import an outer layer.',
  },
  {
    group: ['../data/*', '../platform/*', '../ui/*', '../features/*', '../runtime/*'],
    message: 'Dependencies point inward. src/domain may not import an outer layer.',
  },
]

export default defineConfig(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '.expo/',
      'specs/',
      '.specify/',
      '.claude/',
    ],
  },

  expoConfig,
  ...tsConfigs.recommended,

  {
    rules: {
      // Constitution Principle II: clean code ceilings.
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error', // logging goes through the Logger port
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // A member's visibility is part of its declaration, not something to infer from
      // naming or call sites. TypeScript's implicit `public` hides where the contract
      // ends and the internals begin.
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
    },
  },

  // Constitution Principle III: the domain boundary.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: FORBIDDEN_IN_DOMAIN }],
    },
  },

  // Constitution Principle VI: design values live in exactly one place.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'app/**/*.tsx'],
    ignores: ['src/ui/tokens/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Hard-coded color. Import it from src/ui/tokens instead.',
        },
        {
          selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]',
          message: 'Hard-coded color. Import it from src/ui/tokens instead.',
        },
        {
          selector: `Property[key.name=${SPACING_PROPERTIES}] Literal[raw=/^[0-9]/]`,
          message: 'Hard-coded spacing. Import it from src/ui/tokens instead.',
        },
        {
          selector: `Property[key.name=${RADIUS_PROPERTIES}] Literal[raw=/^[0-9]/]`,
          message: 'Hard-coded radius. Import `radius` from src/ui/tokens instead.',
        },
        {
          selector: `Property[key.name=${TYPE_SIZE_PROPERTIES}] Literal[raw=/^[0-9]/]`,
          message: 'Hard-coded type size. Import `typography` from src/ui/tokens instead.',
        },
        {
          selector: `Property[key.name=${BORDER_WIDTH_PROPERTIES}] Literal[raw=/^[0-9]/]`,
          message: 'Hard-coded border width. Import `borderWidth` from src/ui/tokens instead.',
        },
        {
          selector: `Property[key.name=${OPACITY_PROPERTIES}] Literal[raw=/^[0-9]/]`,
          message: 'Hard-coded opacity. Import `opacity` from src/ui/tokens instead.',
        },
      ],
    },
  },

  // Tests and scripts may be long and may reach for console.
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'scripts/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-console': 'off',
    },
  },
)
