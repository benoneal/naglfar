import buble from '@rollup/plugin-buble'
import pack from './package.json' assert {type: 'json'}

const external = [...Object.keys(pack.peerDependencies), 'react-dom/server']

const plugins = [
  buble({
    objectAssign: true,
    transforms: {
      asyncAwait: false,
      spreadRest: false,
      generator: false,
      dangerousForOf: true,
    },
  }),
]

export default [{
  input: 'src/index.js',
  plugins,
  external,
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
  output: {
    file: 'index.js',
    format: 'cjs',
    exports: 'named',
    sourcemap: false,
    strict: false,
    globals: {react: 'React'},
  }
}];
