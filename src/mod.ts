/** # @oazmi/esbuild-generic-loader
 * 
 * A utility library for building generic file loading plugins for esbuild that are compatible with `Deno` runtime and its esbuild plugin ([`jsr:@luca/esbuild-deno-loader`](https://jsr.io/@luca/esbuild-deno-loader)).
*/

export * from "./funcdefs.ts"
export { GenericLoader } from "./loader.ts"
export type * from "./typedefs.ts"

