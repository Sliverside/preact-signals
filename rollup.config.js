import { nodeResolve } from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import scss from 'rollup-plugin-scss'
import terser from '@rollup/plugin-terser'

export default [
  // {
  //   input: 'main.js',
  //   output: {
  //     file: 'dist/main.js',
  //     format: 'iife',
  //     name: 'components'
  //   },
  //   plugins: [
  //     scss({ fileName: 'main.css' }),
  //     nodeResolve(),
  //     babel({ babelHelpers: "bundled" })
  //   ],
  // },
  {
    input: 'main2.js',
    output: {
      file: 'dist/main2.js',
      format: 'iife',
      name: 'formComponents',
      sourcemap: true
    },
    plugins: [
      scss({ fileName: 'main.css' }),
      nodeResolve(),
      babel({
        babelHelpers: "bundled",
        presets: ['@babel/env']
      }),
      terser()
    ],
  }
]
