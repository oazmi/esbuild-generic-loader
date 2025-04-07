export { console_log, json_parse, json_stringify, math_min, noop, object_entries, object_fromEntries, object_keys, object_values, promise_all } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/alias.js"
export { rangeArray, zipArrays, zipIteratorsMapperFactory } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/array1d.js"
export { ensureFile, getRuntime, getRuntimeCwd, identifyCurrentRuntime, readFile, RUNTIME, writeFile, writeTextFile, type WriteFileConfig } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/crossenv.js"
export { ensureEndSlash, ensureFileUrlIsLocalPath, getUriScheme, joinPaths, parseFilepathInfo, pathToPosixPath, relativePath, resolveAsUrl, resolvePathFactory } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/pathman.js"
export { escapeLiteralStringForRegex } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/stringman.js"
export { isArray, isString } from "./deps/jsr.io/@oazmi/kitchensink/0.9.13/src/struct.js"

/** flags used for minifying (or eliminating) debugging logs and asserts, when an intelligent bundler, such as `esbuild`, is used. */
export const enum DEBUG {
	META = 1,
	LOG = 0,
	ASSERT = 1,
	ERROR = 1,
	PRODUCTION = 1,
	MINIFY = 1,
}
