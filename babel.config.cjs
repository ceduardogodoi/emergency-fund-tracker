// .cjs, not .js: babel-jest loads this config synchronously and Babel's ESM config path
// is async, so this file must be CommonJS. The extension says so explicitly rather than
// leaving it to package.json's `type` field. Every config that can be ESM is .mjs.
//
// ConfigFunction types both the `api` parameter and the returned options, so the config
// is checked in-editor despite not being TypeScript.

/** @type {import('@babel/core').ConfigFunction} */
module.exports = (api) => {
  api.cache(true)

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  }
}
