/** this module contains base type definitions.
 * 
 * @module
*/
import type { GenericLoader } from "./loader.ts"


export type RelativePath = string
export type AbsolutePath = string
export type Path = RelativePath | AbsolutePath

export interface GenericLoaderConfig {
	/** the absolute path of the file that you are providing the contents of to {@link GenericLoader}.
	 * 
	 * this value is used for deducing the directory in which the html exists, so that any relative references made in the html file will be discoverable. <br>
	 * if no path is provided, then it will be assumed that the html file exists in the current working directory (i.e. something like `"./index.html"`). <br>
	 * the absolute path can also use a uri scheme like `"http://"` or `"jsr:"` or `"file://"`, but if a relative path was provided,
	 * we would again assume that it is relative to the current working directory.
	*/
	path?: AbsolutePath

	/** TODO: define how the file should bundle its dependencies:
	 * - `"bundle"` | `undefined`: the file will reference its entry points will be bundled as separate files, inheriting the basename of the importer javascript.
	 * - `"inject"`: any referenced files via `<script src="./file.js">` or `<link rel="stylesheet" href="./file.css">` will get injected be bundled into a string literal, which will then get injected into your html `document`'s head as a `<style>` element.
	 * - `"inject-link"`: similar to `"bundle"`, but will also inject a `<link>` element into your `document`'s head that link's to the output bundled file.
	*/
	mode?: "bundle" | "inject" | "inject-link"
}

export interface ContentDependencies {
	importKeys: Array<string>
	importPaths: Array<string>
	content: string
}

export interface ScriptWrappedContent extends ContentDependencies {
	content: string
}

export interface ImportMetadata {
	/** unique key assigned by the dependency extractor method {@link GenericLoader.extractDeps}. */
	[key: string]: {
		/** the original path of the import link. */
		in: string
		/** the output bundled path of the import link. */
		out: string
	}
}
