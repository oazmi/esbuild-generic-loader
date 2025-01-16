export { console_log, json_parse, json_stringify, math_min, object_entries, object_fromEntries, object_keys, object_values, promise_all } from "jsr:@oazmi/kitchensink@0.9.2/alias"
export { rangeArray, zipArrays, zipIteratorsMapperFactory } from "jsr:@oazmi/kitchensink@0.9.2/array1d"
export { ensureEndSlash, getUriScheme, joinPaths, pathToPosixPath, relativePath, resolveAsUrl, resolvePathFactory } from "jsr:@oazmi/kitchensink@0.9.2/pathman"
export { escapeLiteralStringForRegex } from "jsr:@oazmi/kitchensink@0.9.2/stringman"
export { isArray, isString } from "jsr:@oazmi/kitchensink@0.9.2/struct"

/** flags used for minifying (or eliminating) debugging logs and asserts, when an intelligent bundler, such as `esbuild`, is used. */
export const enum DEBUG {
	META = 1,
	LOG = 0,
	ASSERT = 1,
	ERROR = 1,
	PRODUCTION = 1,
	MINIFY = 1,
}
