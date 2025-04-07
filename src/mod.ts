/** # @oazmi/esbuild-generic-loader
 * 
 * A utility library for building generic file loading plugins for esbuild that are compatible with `Deno` runtime and its esbuild plugin ([`jsr:@luca/esbuild-deno-loader`](https://jsr.io/@luca/esbuild-deno-loader)).
*/
import "./_dnt.polyfills.js";


export * from "./funcdefs.js"
export { GenericLoader } from "./loader.js"
export type * from "./typedefs.js"

