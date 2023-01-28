import resolve from '@rollup/plugin-node-resolve';
import css from'rollup-plugin-css-only';
import json from "@rollup/plugin-json";
import glslify from 'rollup-plugin-glslify';
export default {
  input: './main.js',
  output: [
    {
      format: 'esm',
      file: '../resources/main.js',
      inlineDynamicImports: true
    },
  ],
  plugins: [
    resolve(),
    css({output:'bundle.css'}),
    glslify(),
    json()
  ]
};
