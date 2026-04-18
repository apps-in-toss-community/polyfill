import { defineConfig, type Options } from 'tsdown';
import pkg from './package.json' with { type: 'json' };

// __VERSION__ replaced in source at build time so `VERSION` reflects the real
// package.json value without an import hack.
const define = {
  __VERSION__: JSON.stringify(pkg.version),
};

// `package.json` uses `"type": "module"` and its exports expect `.js` for ESM.
const outExtensions: Options['outExtensions'] = ({ format }) => {
  if (format === 'cjs') return { js: '.cjs', dts: '.d.cts' };
  return { js: '.js', dts: '.d.ts' };
};

const common = {
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outExtensions,
  define,
} as const;

// Each entry is its own config so tsdown/Rolldown does not emit a shared hashed
// chunk at `dist/` root — every entry point stands alone.
export default defineConfig([
  {
    ...common,
    entry: { index: 'src/index.ts' },
    format: ['esm'],
  },
  {
    ...common,
    entry: { 'shims/clipboard': 'src/shims/clipboard.ts' },
    format: ['esm'],
  },
  {
    ...common,
    entry: { detect: 'src/detect.ts' },
    format: ['esm'],
  },
]);
