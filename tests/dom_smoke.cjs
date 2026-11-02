// Optional: npm install --no-save jsdom; node tests/dom_smoke.cjs
const esbuild = require('esbuild')
const Module = require('node:module')
const path = require('node:path')
const result = esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'dom_scenario.cjs')], bundle: true,
  platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external: ['jsdom'],
  define: {'import.meta.env.VITE_API_URL': 'undefined'},
})
const bundled = new Module(path.join(__dirname, '.dom-test.cjs'), module)
bundled.filename = path.join(__dirname, '.dom-test.cjs')
bundled.paths = Module._nodeModulePaths(__dirname)
bundled._compile(result.outputFiles[0].text, bundled.filename)
