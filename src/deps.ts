export { console_log, json_parse, json_stringify, math_min, object_entries, object_fromEntries, object_keys, object_values, promise_all } from "jsr:@oazmi/kitchensink@0.8.5/alias"
export { ensureEndSlash, getUriScheme, joinPaths, pathToPosixPath, relativePath, resolveAsUrl, resolvePathFactory } from "jsr:@oazmi/kitchensink@0.8.5/pathman"
export { isArray, isString } from "jsr:@oazmi/kitchensink@0.8.5/struct"

/** flags used for minifying (or eliminating) debugging logs and asserts, when an intelligent bundler, such as `esbuild`, is used. */
export const enum DEBUG {
	META = 1,
	LOG = 0,
	ASSERT = 1,
	ERROR = 1,
	PRODUCTION = 1,
	MINIFY = 1,
}
