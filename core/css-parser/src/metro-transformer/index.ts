// A ready-made Metro babel transformer wrapper for .css/.scss/.sass/.less/.styl (+ their
// .module.* twins) support, so a consuming app's own metro.config.js needs only
// `babelTransformerPath: require.resolve('@symbiote-native/<adapter>/metro-css-parser')` instead of
// hand-rolling the "compile a style file, delegate everything else to upstream" boilerplate once
// per adapter's example. @symbiote-native/css-parser is a regular `dependency` of every adapter
// package (@symbiote-native/react, @symbiote-native/vue, @symbiote-native/angular), so this is
// transitively resolvable from any app that already depends on one of them — this repo's
// shamefully-hoist pnpm config (.npmrc) makes that resolvable without the app adding
// @symbiote-native/css-parser to its own package.json.
//
// `transform()` is async uniformly, even for plain `.css`: Metro's `metro-transform-worker`
// already awaits `transformer.transform(...)` before using the result (`transformJSWithBabel` in
// its `index.js`), so a babelTransformerPath module returning a Promise is a supported shape.
// SCSS/Less/Stylus compilation is inherently async in Node (Less ships no sync render API;
// Stylus's render is callback-based; Sass's sync `compileString` still needs an async
// `import('sass')` — see preprocessors.ts). No separate sync path for plain `.css`: this only
// runs at Metro build time, content-hash-cached, never a runtime hot path, so forking the
// function to save one microtask isn't worth the duplication.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { compileCssFile } from '../metro-css-module/index.ts';
import { isStyleFile } from '../preprocessors/index.ts';

export interface IMetroTransformParams {
  filename: string;
  src: string;
  [key: string]: unknown;
}

export interface IMetroTransformer {
  // May return a Promise (see the module-level comment) — `unknown` already covers that,
  // Metro's own transform worker awaits the call either way.
  transform: (params: IMetroTransformParams) => unknown;
  getCacheKey?: (...args: unknown[]) => string;
}

// Resolve through the app's Metro config so its transformer and Babel preset use the same
// parser. Consumers without that config (including Expo) use our packaged default.
export function resolveUpstreamTransformer(
  projectRoot: string = process.cwd(),
): IMetroTransformer {
  const appRequire = createRequire(resolve(projectRoot, 'package.json'));
  let metroConfig: string;
  try {
    metroConfig = appRequire.resolve('@react-native/metro-config');
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'MODULE_NOT_FOUND'
    )
      throw error;
    return createRequire(import.meta.url)(
      '@react-native/metro-babel-transformer',
    );
  }
  return createRequire(metroConfig)('@react-native/metro-babel-transformer');
}

export function createCssMetroTransformer(
  upstreamTransformer: IMetroTransformer = resolveUpstreamTransformer(),
): IMetroTransformer {
  return {
    async transform(params) {
      if (!isStyleFile(params.filename))
        return upstreamTransformer.transform(params);
      const { code } = await compileCssFile(params.src, params.filename);
      return upstreamTransformer.transform({
        ...params,
        src: code,
        filename: `${params.filename}.js`,
      });
    },
    getCacheKey: upstreamTransformer.getCacheKey,
  };
}
